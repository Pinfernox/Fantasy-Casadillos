import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg';
import ModalPerfil from "./ModalPerfil";
import ModalAdmin from './ModalAdmin';
import "./Cabecera.css"; // Importamos su propio CSS

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Cabecera({ usuario }) {
  const [dinero, setDinero] = useState(null);
  const [menu, setMenu] = useState(false);
  const [menuActivo, setMenuActivo] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openModalAdmin, setOpenModalAdmin] = useState(false);
  
  const refMenu = useRef(null);
  const fotoURL = usuario?.fotoPerfil || ImagenProfile;
  const logout = () => signOut(auth);

  const toggleMenu = () => setMenu(!menu);

  const formatearDinero = (valor) => {
    return valor.toLocaleString('es-ES') + '€';
  };

  // Cerrar el menú desplegable del perfil si clicas fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (refMenu.current && !refMenu.current.contains(event.target)) {
        setMenuActivo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escuchar el dinero en tiempo real para TODAS las pantallas
  useEffect(() => {
    if (!usuario?.uid) return;
    const refUsuario = doc(db, 'usuarios', usuario.uid);
    const unsubDinero = onSnapshot(refUsuario, (snap) => {
      if (snap.exists()) {
        setDinero(snap.data().dinero);
      }
    });
    return () => unsubDinero();
  }, [usuario]);

// Bloqueo automático 24h antes del próximo evento
  useEffect(() => {
    let intervalId;
    const controlesRef = doc(db, "admin", "controles");
    
    const unsubControles = onSnapshot(controlesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        if (intervalId) clearInterval(intervalId);

        const fechas = data.fechasPartidos || [];
        
        // Si hay fechas programadas y la edición sigue activa
        if (fechas.length > 0 && data.edicionActiva) {
          
          const comprobarCierre = async () => {
            const ahoraMs = new Date().getTime();
            
            // 1️⃣ Encontrar cuál es el PRÓXIMO partido en el futuro
            const proximoPartido = fechas.find(f => new Date(f).getTime() > ahoraMs);

            if (proximoPartido) {
              const fechaPartidoMs = new Date(proximoPartido).getTime();
              const UN_DIA_MS = 24 * 60 * 60 * 1000;

              // 2️⃣ Si queda menos de 24 horas para ESE partido en concreto
              if (fechaPartidoMs - ahoraMs <= UN_DIA_MS) {
                try {
                  await updateDoc(controlesRef, {
                    edicionActiva: false,
                    clausulaPermitida: false
                  });
                  console.log(`🔒 Sistema bloqueado automáticamente. Quedan menos de 24h para el partido: ${proximoPartido}`);
                } catch (e) {
                  console.error("Error en bloqueo automático:", e);
                }
              }
            }
          };

          // Comprobamos al cargar y dejamos el temporizador
          comprobarCierre();
          intervalId = setInterval(comprobarCierre, 60000);
        }
      }
    });

    return () => {
      unsubControles();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <header className="Cabecera">
        <div className="container-profile">
          <div className='img-profile-small' style={{ position: 'relative' }}>
            <img
              src={fotoURL}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
              alt="Foto de perfil"
              onClick={() => setMenuActivo(!menuActivo)}
              onMouseEnter={() => setMenuActivo(true)}
            />

            {menuActivo && (
              <div
                className="perfil-bocadillo"
                ref={refMenu}
                onMouseLeave={() => setMenuActivo(false)}
              >
                <div className="triangulo" />
                <button className="btn-perfil" onClick={() => { setOpenModal(true); setMenuActivo(false); }}>👤 Perfil</button>
                <button className="btn-logout" onClick={logout}>➜] Cerrar sesión</button>
                {usuario?.rol === 'admin' && (
                  <button className="btn-admin" onClick={() => { setOpenModalAdmin(true); setMenuActivo(false); }}>⚙️ Admin</button>
                )}
              </div>
            )}
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">
              {(usuario?.nick || usuario?.displayName)}
            </h2>
            {dinero !== null && (
              <p className="dinero-usuario">
                💰<strong>{formatearDinero(dinero)}</strong>
              </p>
            )}
          </div>
        </div>

        <button onClick={toggleMenu} className="Cabecera-button">
          <svg className='Cabecera-svg' xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
        </button>

        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          <ul className="Cabecera-ul">
            <li className="Cabecera-li"><Link to="/home" className="Cabecera-a">EQUIPO</Link></li>
            <li className="Cabecera-li"><Link to="/mercado" className="Cabecera-a">MERCADO</Link></li>
            <li className="Cabecera-li"><Link to="/clasificacion" className="Cabecera-a">CLASIFICACIÓN</Link></li>
            <li className="Cabecera-li"><Link to="/historial" className="Cabecera-a">HISTORIAL</Link></li>
          </ul>
        </nav>
      </header>

      {/* Los modales viven aquí y funcionan en cualquier pantalla automáticamente */}
      {openModal && <ModalPerfil usuario={usuario} openModal={openModal} setOpenModal={setOpenModal} />}
      {openModalAdmin && <ModalAdmin usuario={usuario} openModal={openModalAdmin} setOpenModal={setOpenModalAdmin} />}
    </>
  );
}