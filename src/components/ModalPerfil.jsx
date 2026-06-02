import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import './ModalPerfil.css'
import { getAuth, updateProfile, updatePassword, EmailAuthProvider, 
  GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail} from 'firebase/auth'
import { collection, query, where, deleteDoc, getFirestore, doc, updateDoc, getDocs, arrayRemove, increment } from 'firebase/firestore'
import ImagenProfile from '/SinPerfil.jpg'

export default function ModalPerfil({ usuario, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const [editable, setEditable] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Estados locales
  const [preview, setPreview] = useState(fotoURL)
  const [file, setFile] = useState(null)
  const [nick, setNick] = useState(usuario.nick)
  const [isSaving, setIsSaving] = useState(false)
  const [originalNick, setOriginalNick] = useState('');

  const overlayRef = useRef()

  useEffect(() => {
    if (openModal) {
        setPreview(usuario.fotoPerfil);
        setFile(null);
        setNick(usuario.nick);
        setOriginalNick(usuario.nick);
    }
  }, [openModal, usuario]);

  useEffect(() => {
    const cambios = nick !== originalNick || file !== null;
    setHasChanges(cambios);
  }, [nick, file, originalNick]);

  const recuperarContrasena = async () => {
    const email = auth.currentUser?.email;
    if (!email) {
      Swal.fire('Error', 'No se encontró un correo asociado al usuario', 'error');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      await Swal.fire('¡Correo enviado!', 'Revisa tu bandeja de entrada o spam', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const formatearDinero = (valor) => {
    if (typeof valor !== 'number') return '0€';
    return valor.toLocaleString('es-ES') + '€';
  };

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) setOpenModal(false)
  }

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

      if (file) {
        if (file.size > 1 * 1024 * 1024) {
            await Swal.fire('Error', "La imagen es demasiado grande (máx. 1 MB).", 'error');
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "perfil_preset");

        const cloudName = "drmoefeeq"; 
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

        const res = await fetch(url, { method: "POST", body: formData });
        const data = await res.json();
        if (data.secure_url) {
          finalPhotoURL = data.secure_url;
        } else {
            Swal.fire('Error', "Error subiendo a Cloudinary", 'error');
            return;
        }
      }

      if (nick !== usuario.nick) {
        await updateProfile(user, { displayName: nick });
      }

      const userRef = doc(db, "usuarios", user.uid);
      await updateDoc(userRef, {
        fotoPerfil: finalPhotoURL,
        nick,
      });
      await Swal.fire('Datos actualizados', 'Se han guardado tus modificaciones correctamente.', 'success')

    } catch (err) {
      console.error("Error guardando perfil:", err);
      Swal.fire('Error', "No se pudo guardar los cambios.", 'error');
    } {
      setIsSaving(false);
      window.location.reload();
    }
  };

  const borrarCuenta = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");
    const uid = user.uid;

    if (user.providerData[0].providerId === "password") {
      const { value: password } = await Swal.fire({
        title: "Confirma tu contraseña",
        input: "password",
        inputLabel: "Introduce tu contraseña para continuar",
        inputPlaceholder: "Tu contraseña",
        showCancelButton: true,
        confirmButtonText: "Confirmar",
        background: "#1e1e1e", color: "#fff",
      });

      if (!password) throw new Error("Se canceló la reautenticación");
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } else if (user.providerData[0].providerId === "google.com") {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
    }

    const q = query(collection(db, "jugadores"), where("dueños", "array-contains", uid));
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map(async (jugadorDoc) => {
      await updateDoc(jugadorDoc.ref, {
        stockLibre: increment(1),
        dueños: arrayRemove(uid),
      });
    });

    await Promise.all(updates);
    await deleteDoc(doc(db, "usuarios", uid));
    await user.delete();
  };

  const handleDeleteClick = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará tu cuenta permanentemente de la liga.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, borrar cuenta',
      background: "#1e1e1e", color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        setIsSaving(true);
        await borrarCuenta();
        await Swal.fire('Cuenta eliminada', 'Tu cuenta ha sido borrada exitosamente.', 'success');
        window.location.reload();
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo borrar la cuenta.', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!openModal) return null

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-perfil custom-modal-perfil">
        <button className="modal-close-btn" onClick={() => setOpenModal(false)}>×</button>

        {/* CABECERA REDISEÑADA */}
        <div className="perfil-header-top">
          <label className="modal-avatar perfil-avatar-wrapper">
            <img src={preview} alt="Perfil" />
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div className="modal-avatar-overlay">✏️ Editar</div>
          </label>
          
          <div className="perfil-user-meta">
            <h2>{usuario.nick}</h2>
            <span className="perfil-email-sub">{usuario.correo}</span>
            <div className="perfil-saldo-pill">
              💰 Saldo: <strong>{formatearDinero(usuario.dinero)}</strong>
            </div>
          </div>
        </div>

        {/* 🚀 CORRECCIÓN DE LOS CUADRADOS DE JORNADA (Forzado a 5 simétricos) */}
        <div className="perfil-jornadas-section">
          <p className="jornadas-section-title">📊 Historial Reciente</p>
          <div className="ultimas-jornadas-perfil">
            {(() => {
              const historial = usuario?.puntuaciones || [];
              const ultimas = historial.slice(-5);
              const emptyCount = 5 - ultimas.length;

              // Generamos el array estático de 5 posiciones
              const arrayToRender = [...ultimas, ...Array(emptyCount).fill(null)];
              const offset = Math.max(0, historial.length - 5);

              return arrayToRender.map((p, i) => {
                const puntos = p != null ? p : "-";
                const jornadaIndex = offset + i + 1;

                let claseColor = "";
                if (typeof p === "number") {
                  if (p >= 36) claseColor = "verde";
                  else if (p < 28) claseColor = "rojo";
                  else claseColor = "naranja";
                }

                return (
                  <div key={i} className="jornada-item-perfil">
                    <small className="jornada-mini-name">J{jornadaIndex}</small>
                    <div className={`jornada-mini-box ${claseColor}`}>{puntos}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <hr className="perfil-separador"/>

        {/* CUERPO Y AJUSTES */}
        <div className="modal-body perfil-body-fields">
          <div className="field-group-custom">
            <label>Nombre de Entrenador (Nick)</label>
            <div className="field-input-wrapper">
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                disabled={!editable}
                maxLength={12}
                placeholder="Tu apodo de liga..."
              />
              <button
                className={`btn-toggle-edit ${editable ? 'editing' : ''}`}
                onClick={() => setEditable(!editable)}
                title="Editar nick"
              >
                {editable ? "💾 Guardar" : "✏️ Editar"}
              </button>
            </div>
          </div>
          
          <div className="perfil-links-container">
            <button type="button" onClick={recuperarContrasena} className="btn-link-pass">
              🔑 Restablecer contraseña por Email
            </button>
          </div>
        </div>

        {/* PIE CON ACCIONES LIMPIAS */}
        <div className="perfil-footer-actions">
          {hasChanges && (
            <button className="btn-perfil-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
            </button>
          )}

          <button className="btn-perfil-delete" onClick={handleDeleteClick} disabled={isSaving}>
            🗑️ Eliminar Cuenta
          </button>
        </div>
      </div>
    </div>
  )
}