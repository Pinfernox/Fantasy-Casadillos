import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { FORMACIONES } from './formations';
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import ImagenProfile from '../assets/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Home.css";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Home({ usuario }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const [menu, setMenu] = useState(false)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  //const formacion = usuario?.equipo?.formacion || "2-1-1";
  const formacion = "1-1-1-1";
  const titulares = usuario?.equipo?.titulares || [];
  const banquillo = usuario?.equipo?.banquillo || [];
  const capitan = usuario?.equipo?.capitan || "";
  const formacionesDisponibles = Object.keys(FORMACIONES);
    // Estado inicial: la formación actual del usuario
  const [formacionActual, setFormacionActual] = useState(usuario?.equipo?.formacion || "2-1-1");
  const [formacionSeleccionada, setFormacionSeleccionada] = useState(formacionActual);
  const [guardando, setGuardando] = useState(false);

  const handleSelect = (e) => {
    setFormacionSeleccionada(e.target.value);
  };

  const guardarFormacion = async () => {
    try {
      setGuardando(true);
      const userRef = doc(db, "usuarios", usuario.uid);
      await updateDoc(userRef, {
        "equipo.formacion": formacionSeleccionada
      });
      setFormacionActual(formacionSeleccionada);
    } catch (error) {
      console.error("Error al guardar formación:", error);
    } finally {
      setGuardando(false);
    }
  };

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
    if (usuario && usuario?.onboarding === false) {
      setShowOnboarding(true);

      const timer = setTimeout(async () => {
        try {
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          await updateDoc(userRef, { onboarding: true });
          window.location.reload(); // refresca la página
        } catch (error) {
          console.error("Error actualizando onboarding:", error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    console.log('Foto de perfil desde Firestore o Auth:', usuario?.fotoPerfil)
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
            onClick={() => signOut(auth)}
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

        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Selector de formaciones */}
          <div className="formacion-selector">
            <label htmlFor="formacion-select">Formación:</label>
            <select id="formacion-select" value={formacionSeleccionada} onChange={handleSelect}>
              {formacionesDisponibles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
                    {formacionSeleccionada !== formacionActual && (
              <button onClick={guardarFormacion} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            )}
          </div>


          <div className="campo">
            {/* Jugadores según formación */}
            {FORMACIONES[formacionSeleccionada]?.map((pos, index) => {
            const jugador = titulares[index];
              return (
                <div
                  key={jugador?.id || index}
                  className="jugador"
                  style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="jugador-wrapper">
                    <img
                      src={jugador?.foto || ImagenProfile}
                      alt={jugador?.nombre || "Vacío"}
                      className="jugador-img"
                    />
                    {/* Insignia de capitán */}
                    {capitan === jugador?.id && (
                      <div className="capitan-badge">C</div>
                    )}
                  </div>
                  <p className="jugador-nombre">{jugador?.nombre || "Vacío"}</p>
                </div>

                      );
                    })}
          </div> 

        </div>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="loader">Cargando...</div>
        </div>
      )}
    </div>
  );
}
