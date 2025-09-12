import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import './ModalPerfil.css'
import { getAuth, updateProfile, updateEmail, updatePassword } from 'firebase/auth'
import { getFirestore, doc, updateDoc } from 'firebase/firestore'
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



  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const abreviarNick = (nick) => {
    if (!nick) return "";

    const maxLength = 10
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
        window.location.href = '/logout'; // O redirige a donde necesites
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
            <img src={preview} alt="Avatar" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <div className="modal-userinfo">
            <h2>{window.innerWidth < 450 ? abreviarNick(usuario.nick) : usuario.nick}</h2>
            <small>{usuario.correo}</small>
          </div>
        </div>
        <hr/>
        <div className="modal-body">
          <div className="field-group">
            <label>Nick <small>(Recomendado máximo 10 caracteres)</small></label>
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

          <div className="field-group">
            <label>Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={true}
            />
          </div>

          <div className="field-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
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
