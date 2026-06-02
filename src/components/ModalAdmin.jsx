import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth'
import { refrescarMercado, resetearMercado } from '../utils/mercadoUtils';
import './ModalAdmin.css'
import { collection, getFirestore, doc, updateDoc, getDoc, getDocs, deleteDoc, writeBatch, setDoc } from 'firebase/firestore'

// 🧠 DICCIONARIO DE FORMACIONES Y PENALIZACIONES
const MAPA_FORMACIONES = {
  "1-1-1-1": ["DEL", "MED", "DEF", "POR"],
  "2-2": ["MED", "MED", "DEF", "DEF"],
  "1-2-1 A": ["DEL", "DEF", "DEF", "POR"],
  "1-2-1 B": ["DEL", "MED", "MED", "DEF"],
  "2-1-1": ["DEL", "MED", "DEF", "DEF"],
  "1-1-2": ["MED", "MED", "DEF", "POR"],
};

const calcularMultiplicador = (posReal, posEsperada) => {
  if (!posReal || !posEsperada) return 0;
  if (posReal === posEsperada) return 1; // 100% de puntos
  
  // Asignamos un número a las posiciones para calcular la "distancia" en el campo
  const orden = { "POR": 0, "DEF": 1, "MED": 2, "DEL": 3 };
  const distancia = Math.abs(orden[posReal] - orden[posEsperada]);
  
  // Si está "Medio mal" (ej: DEL de MED, o POR de DEF) -> distancia 1
  if (distancia === 1) return 0.75; 
  
  // Si está "Mal colado" (ej: DEL de POR, o DEF de DEL) -> distancia 2 o 3
  return 0.25; 
};

export default function ModalAdmin({ user, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const overlayRef = useRef()
  const [loadingMercado, setLoadingMercado] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  
  const [fechasPartidos, setFechasPartidos] = useState([]);
  const [nuevaFecha, setNuevaFecha] = useState("");

  useEffect(() => {
    const cargarFechas = async () => {
      const ref = doc(db, "admin", "controles");
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().fechasPartidos) {
        setFechasPartidos(snap.data().fechasPartidos);
      }
    };
    if (openModal) cargarFechas();
  }, [openModal, db]);

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const agregarPartido = async () => {
    if (!nuevaFecha) return;
    try {
      const actualizadas = [...fechasPartidos, nuevaFecha].sort();
      const ref = doc(db, "admin", "controles");
      await updateDoc(ref, { fechasPartidos: actualizadas });
      
      setFechasPartidos(actualizadas);
      setNuevaFecha("");
      Swal.fire({ title: "¡Añadido!", text: "El partido se ha programado correctamente.", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Error", "No se pudo añadir el partido", "error");
    }
  };

  const eliminarPartido = async (fechaToBorrar) => {
    try {
      const actualizadas = fechasPartidos.filter(f => f !== fechaToBorrar);
      const ref = doc(db, "admin", "controles");
      await updateDoc(ref, { fechasPartidos: actualizadas });
      setFechasPartidos(actualizadas);
    } catch (error) {
      console.error(error);
    }
  };

  if (!openModal) return null

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-perfil">
        <button className="modal-close-btn" onClick={() => setOpenModal(false)}>×</button>
        
        <div className="admin-programador">
          <h3 style={{ color: "white", textAlign: "center", marginBottom: "0.5rem" }}>📅 Calendario de Partidos</h3>
          <p style={{ color: "gray", textAlign: "center", fontSize: "0.8rem", marginBottom: "1rem", padding: "0 1rem" }}>
            El sistema se bloqueará 24h antes del próximo partido.
          </p>
          
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "1rem" }}>
            <input 
              type="datetime-local" className="input-fecha" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)}
            />
            <button className="modal-admin-btn-small" onClick={agregarPartido}>Añadir</button>
          </div>

          {fechasPartidos.length > 0 && (
            <ul className="lista-fechas-admin">
              {fechasPartidos.map((f, i) => (
                <li key={i} className="fila-fecha-admin">
                  <span>{new Date(f).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <button onClick={() => eliminarPartido(f)}>❌</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <hr/>

        <div className="modal-footer-grid">
          <button 
            type="button" className="modal-admin-btn" disabled={loadingMercado}
            onClick={async () => {
              setLoadingMercado(true);
              try {
                await refrescarMercado();
                const res = await Swal.fire({ title: "Mercado actualizado", icon: "success", confirmButtonText: "Aceptar" });
                if (res.isConfirmed) setOpenModal(false);
              } catch (err) {
                Swal.fire({ title: "Error", text: "No se pudo actualizar el mercado", icon: "error" });
              } finally {
                setLoadingMercado(false);
              }
            }}>
            {loadingMercado ? "⏳ Cargando..." : "🔄 Actualizar mercado"}
          </button>

          <button 
            type="button" className="modal-admin-btn" disabled={loadingReset}
            onClick={async () => {
              setLoadingReset(true);
              try {
                await resetearMercado();
                const res = await Swal.fire({ title: "Éxito", icon: "success", confirmButtonText: "Aceptar" });
                if (res.isConfirmed) setOpenModal(false);
              } catch (e) {
                Swal.fire({ title: "Error", text: "No se pudo resetear el mercado", icon: "error" });
              } finally {
                setLoadingReset(false);
              }
            }}>
            {loadingReset ? "⏳ Reseteando..." : "♻️ Resetear mercado"}
          </button>

          <button 
            type="button" className="modal-admin-btn"
            onClick={async () => {
              try {
                const ref = doc(db, "admin", "controles");
                await updateDoc(ref, { edicionActiva: false, clausulaPermitida: false });
                await Swal.fire({ title: "Jornada iniciada", text: "Se han bloqueado los cambios", icon: "success", confirmButtonText: "Aceptar" });
                setOpenModal(false);
                //window.location.reload();
              } catch (err) {
                Swal.fire({ title: "Error", text: "No se pudo empezar la jornada", icon: "error" });
              }
            }}>
            ⏱️ Forzar bloqueo ahora
          </button>
          
          {/* BOTÓN 1: TOMAR LA FOTO Y ABRIR MERCADO */}
          <button 
            type="button" className="modal-admin-btn"
            onClick={async () => {
              try {
                Swal.fire({ title: "Guardando foto de plantillas...", didOpen: () => Swal.showLoading() });
                
                // 1. Coger las plantillas de todos en este preciso instante
                const usuariosSnap = await getDocs(collection(db, "usuarios"));
                const snapshotData = {};
                usuariosSnap.forEach(u => {
                  snapshotData[u.id] = {
                    nick: u.data().nick,
                    formacion: u.data().equipo?.formacion || "2-1-1",
                    titulares: u.data().equipo?.titulares || [],
                    capitan: u.data().equipo?.capitan || null 
                  };
                });

                // 2. Guardarlo en un documento oculto (sobreescribe la jornada anterior)
                await setDoc(doc(db, "admin", "snapshot_jornada"), { 
                  datos: snapshotData, 
                  fecha: new Date().toISOString(),
                  pagado: false 
                });

                // 3. Abrir mercado y limpiar la fecha del partido pasado
                const refControles = doc(db, "admin", "controles");
                
                const fechasFuturas = fechasPartidos.length > 0 ? fechasPartidos.slice(1) : [];

                await updateDoc(refControles, { 
                  edicionActiva: true, 
                  clausulaPermitida: true,
                  fechasPartidos: fechasFuturas 
                });
                
                // 🚀 Actualizamos también el estado de la pantalla para que la fecha desaparezca visualmente
                setFechasPartidos(fechasFuturas); 

                await Swal.fire({ title: "¡Foto tomada y mercado abierto!", text: "Ya puedes poner las notas tranquilamente y la familia ya puede fichar.", icon: "success" });
                setOpenModal(false);
              } catch (err) {
                Swal.fire({ title: "Error", text: "No se pudo guardar la foto", icon: "error" });
              }
            }}>
            📸 Tomar Foto y Abrir Mercado
          </button>

          {/* BOTÓN 2: REPARTIR EL DINERO USANDO LA FOTO */}
          <button 
            type="button" className="modal-admin-btn"
            onClick={async () => {
              try {
                Swal.fire({ title: "Calculando pagos...", text: "Evaluando posiciones...", didOpen: () => Swal.showLoading() });

                // 1. Leer la foto guardada
                const snapRef = await getDoc(doc(db, "admin", "snapshot_jornada"));
                if (!snapRef.exists() || snapRef.data().pagado) {
                   Swal.fire("Aviso", "No hay ninguna jornada pendiente de pago.", "info");
                   return;
                }
                const snapshot = snapRef.data().datos;

                // 2. Traer datos frescos de jugadores y usuarios
                const jugadoresSnap = await getDocs(collection(db, "jugadores"));
                const mapaJugadores = {};
                jugadoresSnap.forEach(doc => { mapaJugadores[doc.id] = doc.data(); });

                const usuariosActivosSnap = await getDocs(collection(db, "usuarios"));
                const datosUsuariosActivos = {};
                usuariosActivosSnap.forEach(u => datosUsuariosActivos[u.id] = u.data());

                const batch = writeBatch(db);
                let resumenResultados = "";
                const PREMIO_POR_PUNTO = 10000; 

// 3. Evaluar usuario por usuario
                for (const userId in snapshot) {
                  const userFoto = snapshot[userId];
                  const userData = datosUsuariosActivos[userId];
                  if (!userFoto || !userFoto.titulares) {
                    console.warn(`El usuario ${userId} no tenía equipo en la foto.`);
                    continue;
                  }

                  const formacion = userFoto.formacion;
                  const posicionesEsperadas = MAPA_FORMACIONES[formacion] || MAPA_FORMACIONES["2-1-1"];
                  const capitanId = userFoto.capitan; 
                  let puntosJornada = 0;
                  
                  // 🚨 REGLA FANTASY: ¿Tiene el equipo incompleto? (Algún hueco libre en los 4 titulares)
                  let equipoIncompleto = false;
                  for (let i = 0; i < 4; i++) {
                    if (!userFoto.titulares[i] || !userFoto.titulares[i].jugadorId) {
                      equipoIncompleto = true;
                      break;
                    }
                  }

                  // Si el equipo está incompleto, se queda con 0 puntos. Si está completo, calculamos.
                  if (!equipoIncompleto) {
                    // Evaluar solo a los 4 titulares
                    userFoto.titulares.forEach((slot, index) => {
                      if (slot && slot.jugadorId && index < 4) { 
                        const jugador = mapaJugadores[slot.jugadorId];
                        if (jugador && jugador.puntosPorJornada && jugador.puntosPorJornada.length > 0) {
                          const ultimosPuntos = jugador.puntosPorJornada[jugador.puntosPorJornada.length - 1];
                          
                          if (typeof ultimosPuntos === 'number') {
                            const posReal = jugador.posicion;
                            const posEsperada = posicionesEsperadas[index];
                            
                            // 1. Calculamos puntos base con penalización por posición
                            const multiplicadorPos = calcularMultiplicador(posReal, posEsperada);
                            let puntosJugador = ultimosPuntos * multiplicadorPos;

                            // 2. Aplicamos multiplicador de CAPITÁN (x2) si coincide el ID
                            if (slot.jugadorId === capitanId) {
                              puntosJugador *= 2;
                            }

                            puntosJornada += puntosJugador;
                          }
                        }
                      }
                    });
                    
                    // 🧮 Redondear para no tener decimales en la clasificación final
                    puntosJornada = Math.round(puntosJornada);
                  }

                  const dineroGanado = puntosJornada * PREMIO_POR_PUNTO;
                  
                  // 📈 Añadir los puntos de esta jornada al historial del usuario
                  const historialPuntuaciones = userData.puntuaciones || [];
                  const nuevasPuntuaciones = [...historialPuntuaciones, puntosJornada];
                  
                  batch.update(doc(db, "usuarios", userId), {
                     dinero: (userData.dinero || 0) + dineroGanado,
                     puntos: (userData.puntos || 0) + puntosJornada,
                     puntuaciones: nuevasPuntuaciones // <-- ¡Guardamos el array actualizado!
                  });

                  if (equipoIncompleto) {
                     resumenResultados += `<b>${userFoto.nick}</b>: 0 pts <i>(Equipo incompleto)</i><br/>`;
                  } else {
                     resumenResultados += `<b>${userFoto.nick}</b>: +${puntosJornada} pts (+${dineroGanado.toLocaleString('es-ES')}€)<br/>`;
                  }
                }

                // 4. Marcar la foto como pagada para no repetir el cobro
                batch.update(doc(db, "admin", "snapshot_jornada"), { pagado: true });
                await batch.commit();

                await Swal.fire({ 
                  title: "¡Jornada Pagada!", 
                  html: `Se han repartido las recompensas teniendo en cuenta las posiciones:<br/><br/><div style="text-align:left; font-size: 0.9em; background: #1a1a1a; padding: 10px; border-radius: 8px;">${resumenResultados}</div>`, 
                  icon: "success", 
                  background: "#1e1e1e", color: "#fff",
                });
                setOpenModal(false);
                //window.location.reload();
              } catch (err) {
                console.error(err);
                Swal.fire({ title: "Error", text: "No se pudo repartir los puntos.", icon: "error" });
              }
            }}>
            📊 Repartir Puntos (Última foto)
          </button>

        </div>
      </div>
    </div>
  )
}