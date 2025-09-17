import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import './ModalPerfil.css'
import { getAuth, updateProfile, updateEmail, updatePassword, deleteUser, EmailAuthProvider, 
  GoogleAuthProvider, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup, sendPasswordResetEmail} from 'firebase/auth'
import { collection, query, where, deleteDoc, getFirestore, doc, updateDoc, getDoc, getDocs, arrayRemove, increment } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import ImagenProfile from '/SinPerfil.jpg'


export default function ModalPerfil({ usuario, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const [editable, setEditable] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // estados locales
  const [preview, setPreview] = useState(fotoURL)
  const [file, setFile] = useState(null)
  const [nick, setNick] = useState(usuario.nick)
  const [email, setEmail] = useState(usuario.correo)
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [originalNick, setOriginalNick] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');


  // para cerrar al pulsar fuera
  const overlayRef = useRef()

    useEffect(() => {
    if (openModal) {
        setPreview(usuario.fotoPerfil);
        setFile(null);
        setNick(usuario.nick);
        setEmail(usuario.correo);
        setPassword('');

        // guardar originales
        setOriginalNick(usuario.nick);
        setOriginalEmail(usuario.correo);
    }
    }, [openModal, usuario]);


    useEffect(() => {
    const cambios =
        nick !== originalNick ||
        email !== originalEmail ||
        password.length > 0 ||
        file !== null;

    setHasChanges(cambios);
    }, [nick, email, password, file, originalNick, originalEmail]);

  const recuperarContrasena = async () => {
    const email = auth.currentUser?.email; // o usuario.email si lo tienes en tu estado

    if (!email) {
      Swal.fire('Error', 'No se encontró un correo asociado al usuario', 'error');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      await Swal.fire('¡Correo enviado!', 'Revisa tu bandeja de entrada o bandeja de spam', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const formatearDinero = (valor) => {
  return valor.toLocaleString('es-ES') + '€';
  };

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const abreviarNick = (nick) => {
    if (!nick) return "";

    const maxLength = 12
    const firstSpace = nick.indexOf(" ");

    let corte;

    if (firstSpace !== -1 && firstSpace <= maxLength) {
      corte = firstSpace; // cortar en el espacio si está antes de 9
      return nick.slice(0, corte) + "...";
      
    } else if (nick.length > maxLength) {
      corte = maxLength-3; // cortar en 9 si es más largo

      return nick.slice(0, corte) + "...";
    } else {
      return nick; // no hace falta cortar
    }

  };

  const handleFileChange = e => {
    const f = e.target.files[0]
    if (!f) return

    setFile(f)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result)
    reader.readAsDataURL(f)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const user = auth.currentUser;
      let finalPhotoURL = usuario.fotoPerfil;

      // 1) Subir nueva foto si hay file
      if (file) {
        
        if (file.size > 1 * 1024 * 1024) { // 1 MB
            await Swal.fire({
              icon: 'error',
              title: 'Error',
              text: "La imagen es demasiado grande (máx. 1 MB)."
            });

          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "perfil_preset"); // tu preset

        // endpoint de Cloudinary
        const cloudName = "drmoefeeq"; 
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

        const res = await fetch(url, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.secure_url) {
          finalPhotoURL = data.secure_url; // URL de la imagen subida
        } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: "Error subiendo a Cloudinary"
            });
            return;
        }
      }

      // 2) Actualiza nick si cambió
      if (nick !== usuario.nick) {
        await updateProfile(user, { displayName: nick });
      }

      // 3) Cambia contraseña si se escribió
      if (password) {
        await updatePassword(user, password);
      }

      // 4) Guarda en Firestore (URL de Cloudinary en fotoPerfil)
      const userRef = doc(db, "usuarios", user.uid);
      await updateDoc(userRef, {
        fotoPerfil: finalPhotoURL,
        nick,
      });
      await Swal.fire('Datos actualizados', 'Se han guardado sus modificaciones correctamente.', 'success')

    } catch (err) {
      console.error("Error guardando perfil:", err);
      alert("No se pudo guardar los cambios: " + err.message);
    } finally {
      setIsSaving(false);
      window.location.reload();
    }
  };

  const borrarCuenta = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");

    const uid = user.uid;

    // --- 1) Reautenticación ---
    if (user.providerData[0].providerId === "password") {
      // Caso: email y contraseña
      const { value: password } = await Swal.fire({
        title: "Confirma tu contraseña",
        input: "password",
        inputLabel: "Introduce tu contraseña para continuar",
        inputPlaceholder: "Tu contraseña",
        inputAttributes: {
          autocapitalize: "off",
          autocorrect: "off"
        },
        showCancelButton: true,
        confirmButtonText: "Confirmar",
        cancelButtonText: "Cancelar"
      });

      if (!password) throw new Error("Se canceló la reautenticación");

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } else if (user.providerData[0].providerId === "google.com") {
      // Caso: login con Google
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
    } else {
      throw new Error("Proveedor no soportado para reautenticación.");
    }

    // --- 2) Actualizar jugadores ---
    const q = query(collection(db, "jugadores"), where("dueños", "array-contains", uid));
    const snapshot = await getDocs(q);

    const updates = snapshot.docs.map(async (jugadorDoc) => {
      const jugadorRef = jugadorDoc.ref;
      await updateDoc(jugadorRef, {
        stockLibre: increment(1),
        dueños: arrayRemove(uid),
      });
    });

    await Promise.all(updates);

    // --- 3) Eliminar documento de usuario en Firestore ---
    const userRef = doc(db, "usuarios", uid);
    await deleteDoc(userRef);

    // --- 4) Eliminar del Auth ---
    await deleteUser(user);
  };

  const handleDeleteClick = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará tu cuenta permanentemente. No podrás deshacerlo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, borrar cuenta',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        setIsSaving(true);
        await borrarCuenta(); // Aquí va tu función para eliminar la cuenta
        await Swal.fire('Cuenta eliminada', 'Tu cuenta ha sido borrada exitosamente.', 'success');
      } catch (err) {
        console.error("Error al borrar la cuenta:", err);
        Swal.fire('Error', 'No se pudo borrar la cuenta: ' + err.message, 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!openModal) return null

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="modal-perfil">
        {/* botón cerrar */}
        <button
          className="modal-close-btn"
          onClick={() => setOpenModal(false)}
        >
          ×
        </button>

        <div className="modal-header">
          <label className="modal-avatar">
            <img src={preview} alt="Perfil" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            <span className="modal-avatar-overlay">Editar</span>
          </label>
          <div className="modal-userinfo">
            <h2>{window.innerWidth < 450 ? abreviarNick(usuario.nick) : usuario.nick}</h2>
            <small>{usuario.correo}</small>
            <small>
              Dinero: <span className="dinero-verde">{formatearDinero(usuario.dinero)}</span>
            </small>


          </div>
        </div>
        <hr/>
        <div className="modal-body">
          <div className="field-group">
            <label>Nick <small>(Recomendado máximo 12 caracteres)</small></label>
            <div className="field-with-icon">
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                disabled={!editable} // solo editable si el estado es true}
              />
            <button
                    className="icon-pencil"
                    onClick={() => setEditable(!editable)}
                    title="Editar nick">
              ✎
            </button>
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <button type="button" onClick={recuperarContrasena} className="link-style">
              Cambiar contraseña
            </button>
          </div>

        </div>

        <div className="modal-footer">
          {hasChanges && <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar cambios'}
          </button>}

          <button
            className="modal-delete-btn"
            onClick={handleDeleteClick}
            disabled={isSaving}>
            Borrar cuenta
          </button>
        </div>
      </div>
    </div>
  )
}
