import React, { useState, useEffect } from "react";
import { Link, useParams } from 'react-router-dom';
import appFirebase from "../credenciales";
import { FORMACIONES } from './formations';
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Home.css";
import "./EquipoJugador.css"
import ModalJugadorUsuarioJornada from "./ModalJugadorUsuarioJornada";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

const MAPA_FORMACIONES = {
  "1-1-1-1": ["DEL", "MED", "DEF", "POR"],
  "2-2": ["MED", "MED", "DEF", "DEF"],
  "1-2-1 A": ["DEL", "DEF", "DEF", "POR"],
  "1-2-1 B": ["DEL", "MED", "MED", "DEF"],
  "2-1-1": ["DEL", "MED", "DEF", "DEF"],
  "1-1-2": ["MED", "MED", "DEF", "POR"],
};

function getBordeEstilo(jugador, index, formacion) {
  let color = "white"; 
  let status = null;
  if (!jugador) return { style: { borderColor: color }, status };
  const esperado = MAPA_FORMACIONES[formacion]?.[index];
  if (!esperado) return { style: { borderColor: color }, status };
  const posReal = jugador.posicion; 
  const orden = { "POR": 0, "DEF": 1, "MED": 2, "DEL": 3 };
  if (orden[posReal] !== undefined && orden[esperado] !== undefined) {
    const distancia = Math.abs(orden[posReal] - orden[esperado]);
    if (distancia === 0) color = "green"; 
    else if (distancia === 1) color = "orange"; 
    else color = "red"; 
  } else {
    color = "red"; 
  }
  status = color; 
  return { style: { borderColor: color, borderWidth: "3px", borderStyle: "solid" }, status };
}

function calcularPuntosReales(jugador, index, formacion, idCapitan) {
  if (!jugador || !jugador.puntosPorJornada || jugador.puntosPorJornada.length === 0) return "-";
  const ultimosPuntosBase = jugador.puntosPorJornada[jugador.puntosPorJornada.length - 1];
  if (typeof ultimosPuntosBase !== 'number') return "-";
  const esperado = MAPA_FORMACIONES[formacion]?.[index];
  if (!esperado) return ultimosPuntosBase;
  const orden = { "POR": 0, "DEF": 1, "MED": 2, "DEL": 3 };
  const posReal = jugador.posicion;
  let puntosFinales = ultimosPuntosBase;
  if (orden[posReal] !== undefined && orden[esperado] !== undefined) {
    const distancia = Math.abs(orden[posReal] - orden[esperado]);
    if (distancia === 1) puntosFinales *= 0.75;
    else if (distancia >= 2) puntosFinales *= 0.25;
  }
  if (jugador.id === idCapitan) puntosFinales *= 2;
  return Math.round(puntosFinales);
}

export default function EquipoJornada({ usuario }) {
  const { jugadorId } = useParams()
  const [loadingJugador, setLoadingJugador] = useState(true)
  const [jugadorData, setJugadorData] = useState(null)
  const [jugadores, setJugadores] = useState([]);
  const [openModalJugadorUsuario, setOpenModalJugadorUsuario] = useState(false)
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)

  const titulares = jugadorData?.equipo?.titulares || [];
  const capitan = jugadorData?.equipo?.capitan || "";
  const formacionSeleccionada = jugadorData?.equipo?.formacion || "2-1-1";

  // 1. Cargar datos combinados (Perfil en directo + Plantilla Congelada)
  useEffect(() => {
    if (!jugadorId) return;
    const fetchDatosJornada = async () => {
      setLoadingJugador(true);
      try {
        // A) Info general del rival
        const userSnap = await getDoc(doc(db, 'usuarios', jugadorId));
        let userData = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;

        // B) Foto de la jornada
        const snapJornada = await getDoc(doc(db, 'admin', 'snapshot_jornada'));
        let fotoData = null;
        if (snapJornada.exists() && snapJornada.data().datos[jugadorId]) {
            fotoData = snapJornada.data().datos[jugadorId];
        }

        if (userData && fotoData) {
            // Reemplazamos su equipo actual por el de la foto
            userData.equipo = {
                formacion: fotoData.formacion,
                titulares: fotoData.titulares,
                capitan: fotoData.capitan,
                banquillo: [] // No se guarda en la foto, lo omitimos
            };
            setJugadorData(userData);
        } else if (userData) {
            setJugadorData(userData); // Respaldo si no hay foto aún
        }
      } catch (err) {
        console.error("Error fetching jornada:", err);
      } finally {
        setLoadingJugador(false);
      }
    };
    fetchDatosJornada();
  }, [jugadorId]);

  // 2. Cargar jugadores reales de esa foto
  useEffect(() => {
    const fetchJugadores = async () => {
      if (!jugadorData?.equipo) return;
      try {
        const ids = titulares.map(s => s?.jugadorId).filter(Boolean);
        if (ids.length === 0) {
          setJugadores([]);
          return;
        }
        const jugadoresRef = collection(db, "jugadores");
        const q = query(jugadoresRef, where("__name__", "in", ids));
        const snap = await getDocs(q);
        const jugadoresData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJugadores(jugadoresData);
      } catch (err) {
        console.error("Error cargando jugadores:", err);
      }
    };
    fetchJugadores();
  }, [jugadorData]);

  const formatearDinero = (valor) => valor.toLocaleString('es-ES') + '€';

// 👇 PARTÍCULAS OPTIMIZADAS
  useEffect(() => {
    if (window.particlesJS && document.getElementById("particles-js")) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }

    // 🧹 FUNCIÓN DE LIMPIEZA (Mata la animación al cambiar de pantalla)
    return () => {
      if (window.pJSDom && window.pJSDom.length > 0) {
        window.pJSDom.forEach((dom) => {
          if (dom && dom.pJS) {
            cancelAnimationFrame(dom.pJS.fn.drawAnimFrame);
            dom.pJS.fn.vendors.destroypJS();
          }
        });
        window.pJSDom = []; // Vaciamos la memoria global
      }
    };
  }, []); // 🚨 MUY IMPORTANTE: Dejar los corchetes vacíos []

  return (
    <div>
      <Cabecera usuario={usuario} />
      <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        
      {openModalJugadorUsuario && jugadorSeleccionado &&           
              (<ModalJugadorUsuarioJornada 
                jugador={jugadorSeleccionado} 
                clausulaPersonal={titulares.find(j => j.jugadorId === jugadorSeleccionado.id)?.clausulaPersonal} 
                openModal={openModalJugadorUsuario} 
                setOpenModal={setOpenModalJugadorUsuario} 
              />)}
        
        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 , marginTop: '0rem'}}>
{/* NUEVO ENCABEZADO UNIFICADO: Formación y Jornada en la misma línea */}
          <div className="datos-equipo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0 }}><strong>Formación:</strong> <small>{formacionSeleccionada}</small> </p>
            
            {jugadorData?.puntuaciones && jugadorData?.puntuaciones.length > 0 ? (
              (() => {
                const numJornadas = jugadorData.puntuaciones.length;
                const p = jugadorData.puntuaciones[numJornadas - 1];
                const puntos = p != null ? p : "-";

                let claseColor = "";
                if (typeof p === "number") {
                  if (p >= 36) claseColor = "verde";
                  else if (p < 28) claseColor = "rojo";
                  else claseColor = "naranja";
                }

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Jornada {numJornadas}:</strong></p>
                    <div className={`jornada-cuadro ${claseColor}`} style={{ margin: 0 }}>
                      {puntos}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ margin: 0 }}><strong>Sin puntuar:</strong></p>
                <div className="jornada-cuadro" style={{ margin: 0 }}>-</div>
              </div>
            )}
          </div>
          
          <div className="campo">
            {FORMACIONES[formacionSeleccionada]?.map((pos, index) => {
              const slot = titulares[index];
              const jugador = jugadores.find(j => j.id === slot?.jugadorId);

              return (
                <div key={jugador?.id || index} className="jugador" style={{ position: "absolute", top: pos.top, left: pos.left, transform: "translate(-50%, -50%)" }}>
                  <div className="jugador-wrapper">
                    <img
                      src={jugador?.foto || ImagenProfile}
                      alt={jugador?.nombre || "Vacío"}
                      className="jugador-img"
                      style={getBordeEstilo(jugador, index, formacionSeleccionada).style}
                      onClick={() => { setOpenModalJugadorUsuario(true); setJugadorSeleccionado(jugador); }}
                    />
                    {(() => {
                        const { status } = getBordeEstilo(jugador, index, formacionSeleccionada);
                        if (!status) return null;
                        if (status === "green") return <div className="status-badge green">✓</div>;
                        if (status === "orange") return <div className="status-badge orange">!</div>;
                        if (status === "red") return <div className="status-badge red">✕</div>;
                    })()}
                    {capitan === jugador?.id && <div className="capitan-badge">C</div>}
                    {(() => {
                      const puntosReales = calcularPuntosReales(jugador, index, formacionSeleccionada, capitan);
                      if (puntosReales === null || puntosReales === undefined) return null;
                      let claseColor = puntosReales === "-" ? "gray" : puntosReales < 7 ? "red" : puntosReales < 9 ? "orange" : "green";
                      return <div className={`puntos-badge ${claseColor}`}>{puntosReales}</div>;
                    })()}
                  </div>
                  <p className="jugador-nombre">{jugador?.nombre || "Vacío"}</p>
                </div>
              );
            })}
          </div> 
          
          <div className="banquillo-section">
            <h3 className="banquillo-title">⚽ Banquillo</h3>
            <p style={{color: 'gray', fontSize: '0.8rem'}}>El banquillo no se guarda en el registro de la jornada.</p>
          </div>

        </div>
      </div>
    </div>
  );
}