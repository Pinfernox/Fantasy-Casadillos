import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg';
import ModalPerfil from "./ModalPerfil";
import ModalAdmin from './ModalAdmin';
import "./Cabecera.css"; 

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Cabecera({ usuario }) {
  const [dinero, setDinero] = useState(null);
  const [menu, setMenu] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openModalAdmin, setOpenModalAdmin] = useState(false);
  
  const navRef = useRef(null);
  const fotoURL = usuario?.fotoPerfil || ImagenProfile;
  const logout = () => signOut(auth);

  const toggleMenu = () => setMenu(!menu);

  const formatearDinero = (valor) => {
    return valor.toLocaleString('es-ES') + '€';
  };

  // 🎙️ Micrófono abierto para el dinero en tiempo real
  useEffect(() => {
    if (!usuario?.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'usuarios', usuario.uid), (docSnap) => {
      if (docSnap.exists()) {
        setDinero(docSnap.data().dinero);
      }
    });
    return () => unsubscribe();
  }, [usuario]);

  // Cerrar el menú móvil si clicas fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="Cabecera" ref={navRef}>
        
        {/* 1. LOGO (Izquierda) */}
        <div className="Cabecera-logo">
          <Link to="/home" className="logo-link">
            <h1 className="nombre-equipo">Fantasy Casadillos</h1>
          </Link>
        </div>

        {/* BOTÓN HAMBURGUESA (Móvil) */}
        <button onClick={toggleMenu} className="Cabecera-button">
          <svg className='Cabecera-svg' xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
        </button>

        {/* 2. NAVEGACIÓN Y PERFIL (Centro y Derecha) */}
        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          
          {/* ENLACES DEL JUEGO (Centro) */}
          <ul className="Cabecera-ul enlaces-juego">
            <li className="Cabecera-li">
              <Link to="/home" className="Cabecera-a" onClick={() => setMenu(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Equipo
              </Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/mercado" className="Cabecera-a" onClick={() => setMenu(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                Mercado
              </Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/clasificacion" className="Cabecera-a" onClick={() => setMenu(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                Clasificación
              </Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/historial" className="Cabecera-a" onClick={() => setMenu(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Historial
              </Link>
            </li>
          </ul>

          {/* PERFIL, DINERO Y BOTONES SECUNDARIOS (Derecha) */}
          <div className="controles-usuario">
            <div className="info-text">
              <p className="nombre-usuario">{usuario?.nick || "Usuario"}</p>
              <p className="dinero-usuario">{dinero !== null ? formatearDinero(dinero) : "..."}</p>
            </div>

            <div className="img-profile-small" onClick={() => setOpenModal(true)}>
              <img src={fotoURL} alt="Perfil" />
            </div>

            <div className="botones-secundarios">
              {usuario?.rol === 'admin' && (
                <button className="btn-cabecera-secundario admin-btn" onClick={() => setOpenModalAdmin(true)} title="Panel de Administrador">⚙️</button>
              )}
              <button className="btn-cabecera-secundario logout-btn" onClick={logout}>Salir</button>
            </div>
          </div>

        </nav>
      </header>

      {/* MODALES OCULTOS */}
      {openModal && <ModalPerfil usuario={usuario} openModal={openModal} setOpenModal={setOpenModal} />}
      {openModalAdmin && <ModalAdmin user={usuario} openModal={openModalAdmin} setOpenModal={setOpenModalAdmin} />}
    </>
  );
}