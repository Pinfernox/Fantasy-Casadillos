import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import appFirebase from "../credenciales";
import { getAuth, signOut } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import ImagenProfile from "/SinPerfil.jpg";
import Fondo from "../assets/fondo.png";
import "./Historial.css";
import ModalPerfil from "./ModalPerfil";
import ModalAdmin from "./ModalAdmin";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Historial({ usuario }) {
  const [historial, setHistorial] = useState([]);
  const [menu, setMenu] = useState(false);
  const refMenu = useRef(null);
  const [dinero, setDinero] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [openModalAdmin, setOpenModalAdmin] = useState(false);
  const [menuActivo, setMenuActivo] = useState(false);

  const fotoURL = usuario?.fotoPerfil || ImagenProfile;

  const logout = () => signOut(auth);

  // Cerramos el menú si clicas fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (refMenu.current && !refMenu.current.contains(event.target)) {
        setMenuActivo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cargar historial desde Firestore
  useEffect(() => {
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
    const cargarHistorial = async () => {
      try {
        const snap = await getDocs(collection(db, "historial"));
        if (!snap.empty) {
          const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          // ordenamos descendente por fecha si tienen timestamp
          const ordenado = data.sort(
            (a, b) =>
              (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0)
          );
          setHistorial(ordenado);
        } else {
          setHistorial([]);
        }
      } catch (error) {
        console.error("Error cargando historial:", error);
        setHistorial([]);
      }
    };

    cargarHistorial();
  }, []);

  const formatearDinero = (valor) => {
    if (typeof valor !== "number" || isNaN(valor)) return "—";
    return valor.toLocaleString("es-ES") + "€";
  };

  const toggleMenu = () => {
    setMenu(!menu)
  }

  return (
    <div>
      <header className="Cabecera">
        <div className="container-profile">

          <div className='img-profile-small' style={{ position: 'relative' }}>
            <img
              src={fotoURL}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
              alt="Foto de perfil"
              onClick={() => setMenuActivo(!menuActivo)} // toggle con clic
              onMouseEnter={() => setMenuActivo(true)} // hover
            />

            {menuActivo && (
              <div
                className="perfil-bocadillo"
                ref={refMenu}
                onMouseLeave={() => setMenuActivo(false)} // solo se cierra al salir del menú
              >
              <div className="triangulo" />
                  <button className="btn-perfil" onClick={() => { setOpenModal(true); setMenuActivo(false); }}>👤 Perfil</button>
                  
                  <button className="btn-logout" onClick={logout}>➜] Cerrar sesión</button>

                  {usuario?.rol === 'admin' && <button className="btn-admin" onClick={() => { setOpenModalAdmin(true); setMenuActivo(false); }}>⚙️ Admin</button>}
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
            <li className="Cabecera-li">
              <Link to="/historial" className="Cabecera-a">HISTORIAL</Link>
            </li>
          </ul>
        </nav>
      </header>

      <div
        className="login-hero-Cabecera"
        style={{ backgroundImage: `url(${Fondo})` }}
      >
        <div id="particles-js" style={{ position: "absolute", inset: 0 }}></div>

        {openModal && (
          <ModalPerfil
            usuario={usuario}
            openModal={openModal}
            setOpenModal={setOpenModal}
          />
        )}
        {openModalAdmin && (
          <ModalAdmin
            usuario={usuario}
            openModal={openModalAdmin}
            setOpenModal={setOpenModalAdmin}
          />
        )}

        <div className="tabs-wrapper">
          <div className="tabs-container">
            <button className="tab-btn active">Historial de transacciones</button>
          </div>

          <div className="historial-container">
            {historial.length === 0 ? (
              <div className="sin-historial">
                <p>🕒 Todavía no ha habido ninguna transacción</p>
              </div>
            ) : (
              <ul className="lista-historial">
                {historial.map((h) => {
                  let mensaje;
                  let backgroundColor = "#2c2c2c"; // color neutro por defecto

                  if (h.tipo === "venta directa") {
                    backgroundColor = "rgba(59, 1, 1, 0.64)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.vendedorNombre}</strong> ha vendido de forma rápida a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.jugadorNombre}</strong> por{" "}
                        <strong style={{ color: "#e74c3c" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else if (h.tipo === "clausulazo") {
                    backgroundColor = "rgba(0, 67, 6, 0.64)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha pagado la cláusula de{" "}
                        <strong style={{ color: "#2ecc71" }}>{h.jugadorNombre}</strong> a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.vendedorNombre}</strong> por{" "}
                        <strong style={{ color: "#2ecc71" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else {
                    backgroundColor = "rgba(0, 0, 0, 0.65)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha pagado{" "}
                        <strong style={{ color: "#2ecc71" }}>{formatearDinero(h.precio)}</strong> por{" "}
                        <strong style={{ color: "#2ecc71" }}>{h.jugadorNombre}</strong> a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.vendedorNombre}</strong>
                      </>
                    );
                  }

                  return (
                    <li key={h.id} className="historial-item" style={{ backgroundColor }}>
                      <div className="historial-card">
                        <img src={h.fotoJugador} alt={h.jugadorNombre} className="historial-foto" />
                        <div className="historial-info">
                          <p>{mensaje}</p>
                          <small>
                            {h.fecha?.toDate ? h.fecha.toDate().toLocaleString("es-ES") : ""}
                          </small>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

            )}
          </div>
        </div>
      </div>
    </div>
  );
}
