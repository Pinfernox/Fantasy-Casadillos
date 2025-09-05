import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import ImagenProfile from '../assets/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Home.css";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Mercado({ usuario }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const [menu, setMenu] = useState(false)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile

  const toggleMenu = () => {
    setMenu(!menu)
  }

  // Función para abreviar el dinero
  const formatearDinero = (valor) => {
    if (valor >= 1_000_000) {
      return (valor / 1_000_000).toFixed(2) + 'M'
    } else if (valor >= 1_000) {
      return (valor / 1_000).toFixed(2) + 'K'
    } else {
      return valor.toFixed(2)
    }
  }

  const abreviarNick = (nick) => {
    if (!nick) return "";

    const maxLength = 12
    const firstSpace = nick.indexOf(" ");

    let corte;

    if (firstSpace !== -1 && firstSpace <= maxLength) {
      corte = firstSpace; // cortar en el espacio si está antes de 9
      return nick.slice(0, corte);
      
    } else if (nick.length > maxLength) {
      corte = maxLength-3; // cortar en 9 si es más largo

      return nick.slice(0, corte) + "...";
    } else {
      return nick; // no hace falta cortar
    }

  };

  useEffect(() => {

    // Partículas
    if (window.particlesJS) {
      window.particlesJS.load('particles-js', 'particles.json', () => {
        console.log('Particles.js config cargado')
      })
      
    }
    
    // Leer dinero de Firestore
    if (usuario) {
      const ref = doc(db, 'usuarios', usuario.uid)
      getDoc(ref).then((snap) => {
        if (snap.exists()) {
          setDinero(snap.data().dinero)
        }
      })
    }
  }, [usuario]);

  return (
    <div>
      <header className="Cabecera">
        <div className="container-profile">

          <div className='img-profile-small'>
            
          <img
            src={
              fotoURL
            }
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = ImagenProfile
            }}
            alt="Foto de perfil"
          />
            
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">
              {abreviarNick(usuario?.nick || usuario?.displayName)}
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
            <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
        </button>

        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          <ul className="Cabecera-ul">
            <li className="Cabecera-li">
              <Link to="/home" className="Cabecera-a">EQUIPO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/mercado" className="Cabecera-a">MERCADO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/clasificacion" className="Cabecera-a">CLASIFICACIÓN</Link>
            </li>

          </ul>
        </nav>

      </header>

            <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`,}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>

        <div
          className="form-card-Home"
          style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
        >

        </div>
      </div>

      {/* CONTENIDO DEBAJO CON FONDO NEGRO */}
      <div className="contenido-negro">
        <h2>Contenido debajo del fondo</h2>
        <p>Aquí puedes seguir añadiendo secciones.</p>
      </div>


    </div>
  );
}
