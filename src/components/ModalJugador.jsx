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


export default function ModalPerfilJugador({ jugador, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = jugador?.foto || ImagenProfile

  // para cerrar al pulsar fuera
  const overlayRef = useRef()

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const abreviarnombre = (nombre) => {
    if (!nombre) return "";

    const maxLength = 10
    const firstSpace = nombre.indexOf(" ");

    let corte;

    if (firstSpace !== -1 && firstSpace <= maxLength) {
      corte = firstSpace; // cortar en el espacio si está antes de 9
      return nombre.slice(0, corte) + "...";
      
    } else if (nombre.length > maxLength) {
      corte = maxLength-3; // cortar en 9 si es más largo

      return nombre.slice(0, corte) + "...";
    } else {
      return nombre; // no hace falta cortar
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
            <img src={fotoURL} alt="Perfil" />
            <input
              type="file"
              accept="image/*"
            />
          </label>
          <div className="modal-userinfo">
            <h2>{window.innerWidth < 450 ? abreviarnombre(jugador.nombre) : jugador.nombre}</h2>
            <small>{jugador.goles}</small>
            <small>{jugador.asistencias}</small>

          </div>
        </div>
        <hr/>
        <div className="modal-body">
          <div className="field-group">
            <label>Nombre</label>
            <div className="field-with-icon">
              <label>{jugador.partidos}</label>
            </div>
          </div>

        </div>

        <div className="modal-footer">

        </div>
      </div>
    </div>
  )
}
