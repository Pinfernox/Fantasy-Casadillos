import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import { getAuth, updateProfile, updateEmail, updatePassword, deleteUser, EmailAuthProvider, 
  GoogleAuthProvider, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup, sendPasswordResetEmail} from 'firebase/auth'
import { collection, query, where, deleteDoc, getFirestore, doc, updateDoc, getDoc, getDocs, arrayRemove, increment } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { refrescarMercado } from "../utils/mercadoUtils";
import { resetearMercado } from '../utils/mercadoUtils';
import './ModalAdmin.css'

export default function ModalAdmin({user, openModal, setOpenModal}) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const overlayRef = useRef()
  const [loadingMercado, setLoadingMercado] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);


  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

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
          <div className="modal-footer-grid">
            <button 
              type="button" 
              className="modal-admin-btn"
              disabled={loadingMercado}
              onClick={async () => {
                setLoadingMercado(true);
                try {
                  await refrescarMercado();
                  const resultado = await Swal.fire({
                    title: "Mercado actualizado",
                    text: "Se ha refrescado el mercado correctamente",
                    icon: "success",
                    confirmButtonText: "Aceptar",
                  });

                  if (resultado.isConfirmed) {
                    setOpenModal(false);
                  }
                } catch (err) {
                  console.error(err);
                  await Swal.fire({
                    title: "Error",
                    text: "No se pudo actualizar el mercado",
                    icon: "error",
                    confirmButtonText: "Aceptar",
                  });
                } finally {
                  setLoadingMercado(false);
                }
              }}
            >
              {loadingMercado ? "⏳ Cargando..." : "🔄 Actualizar mercado"}
            </button>

            <button 
              type="button" 
              className="modal-admin-btn"
              disabled={loadingReset}
              onClick={async () => {
                setLoadingReset(true);
                try {
                  await resetearMercado();
                  const resultado = await Swal.fire({
                    title: "Éxito",
                    text: "El mercado se ha reseteado correctamente",
                    icon: "success",
                    confirmButtonText: "Aceptar",
                  });

                  if (resultado.isConfirmed) {
                    setOpenModal(false); // Cierra el modal
                  }
                } catch (e) {
                  await Swal.fire({
                    title: "Error",
                    text: "No se pudo resetear el mercado",
                    icon: "error",
                    confirmButtonText: "Aceptar",
                  });
                } finally {
                  setLoadingReset(false);
                }
              }}>
              {loadingReset ? "⏳ Reseteando..." : "♻️ Resetear mercado"}
            </button>

            <button 
              type="button" 
              className="modal-admin-btn"
              onClick={async () => {
                try {
                  const ref = doc(db, "admin", "controles");
                  await updateDoc(ref, { edicionActiva: false });

                  await Swal.fire({
                    title: "Jornada iniciada",
                    text: "Se han bloqueado los cambios de formaciones y mercado",
                    icon: "success",
                    confirmButtonText: "Aceptar",
                  });
                  window.location.reload();
                } catch (err) {
                  console.error("Error al empezar jornada:", err);
                  await Swal.fire({
                    title: "Error",
                    text: "No se pudo empezar la jornada",
                    icon: "error",
                    confirmButtonText: "Aceptar",
                  });
                }
              }}
            >
              ⏱️ Empezar jornada
            </button>
            
            <button 
              type="button" 
              className="modal-admin-btn"
              onClick={async () => {
                try {
                  const ref = doc(db, "admin", "controles");
                  await updateDoc(ref, { edicionActiva: true });

                  await Swal.fire({
                    title: "Jornada finalizada",
                    text: "Se han repartido los puntos y desbloqueado la edición",
                    icon: "success",
                    confirmButtonText: "Aceptar",
                  });
                  window.location.reload();

                } catch (err) {
                  console.error("Error al finalizar la jornada:", err);
                  await Swal.fire({
                    title: "Error",
                    text: "No se pudo acabar la jornada",
                    icon: "error",
                    confirmButtonText: "Aceptar",
                  });
                }
              }} >
              📊 Repartir puntos
            </button>



          </div>
      </div>
    </div>
  )
}
