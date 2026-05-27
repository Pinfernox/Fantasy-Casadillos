import React, { useState, useEffect, useRef } from 'react'
import './ModalJugador.css'
import { getAuth} from 'firebase/auth'
import Swal from 'sweetalert2';
import { 
  getFirestore, doc, getDoc, updateDoc, addDoc, collection, arrayUnion, arrayRemove, deleteDoc, query, where, getDocs 
} from "firebase/firestore";
import { getStorage} from 'firebase/storage'
import ImagenProfile from '/SinPerfil.jpg'
import { runTransaction } from "firebase/firestore"; // Asegúrate de importar runTransaction arriba

export default function ModalPerfilJugadorUsuario({ jugador, clausulaPersonal, openModal, setOpenModal, idUsuario }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = jugador?.foto || ImagenProfile
  const [edicionActiva, setEdicionActiva] = useState(false);
  const [clausulaPermitida, setClausulaPermitida] = useState(false);


  const pagarClausula = async () => {
      if (!jugador || !auth.currentUser) return;

      if (!clausulaPermitida || !edicionActiva) {
        await Swal.fire({
          icon: "error",
          title: "Jornada Empezada",
          text: "No se pueden pagar cláusulas con la jornada empezada o bloqueada.",
          confirmButtonText: "Ok",
        });
        return;
      }

      const user = auth.currentUser; 
      const userRef = doc(db, "usuarios", user.uid);
      const vendedorRef = doc(db, "usuarios", idUsuario);
      const jugadorRef = doc(db, "jugadores", jugador.id);
      const mercadoUsuariosRef = doc(db, "mercadoUsuarios", "actual");

      try {
        await runTransaction(db, async (tx) => {
          // 1️⃣ LECTURAS (Siempre primero en una transacción)
          const snapComprador = await tx.get(userRef);
          const snapVendedor = await tx.get(vendedorRef);
          const snapMercado = await tx.get(mercadoUsuariosRef);

          if (!snapComprador.exists() || !snapVendedor.exists()) {
            throw new Error("Usuario no encontrado en la base de datos");
          }

          const dataComprador = snapComprador.data();
          const dataVendedor = snapVendedor.data();

          // 2️⃣ VERIFICACIONES
          const huecoTitulares = dataComprador.equipo.titulares.findIndex(j => !j || j.jugadorId === null);
          const huecoBanquillo = dataComprador.equipo.banquillo.findIndex(j => !j || j.jugadorId === null);

          if (huecoTitulares === -1 && huecoBanquillo === -1) {
            throw new Error("EQUIPO_LLENO");
          }

          if ((dataComprador.dinero || 0) < clausulaPersonal) {
            throw new Error("SIN_DINERO");
          }

          // 3️⃣ ESCRITURAS - ECONOMÍA
          tx.update(userRef, { dinero: (dataComprador.dinero || 0) - clausulaPersonal });
          tx.update(vendedorRef, { dinero: (dataVendedor.dinero || 0) + clausulaPersonal });

          // 4️⃣ MOVER JUGADOR AL COMPRADOR
          let nuevosTitulares = [...dataComprador.equipo.titulares];
          let nuevoBanquillo = [...dataComprador.equipo.banquillo];
          const nuevaClausula = Math.round(clausulaPersonal * 1.5);

          if (huecoTitulares !== -1) {
            nuevosTitulares[huecoTitulares] = { jugadorId: jugador.id, clausulaPersonal: nuevaClausula };
          } else {
            nuevoBanquillo[huecoBanquillo] = { jugadorId: jugador.id, clausulaPersonal: nuevaClausula };
          }
          tx.update(userRef, { "equipo.titulares": nuevosTitulares, "equipo.banquillo": nuevoBanquillo });

          // 5️⃣ QUITAR JUGADOR AL VENDEDOR
          let titularesVend = [...dataVendedor.equipo.titulares].map(j =>
            j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
          let banquilloVend = [...dataVendedor.equipo.banquillo].map(j =>
            j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
          tx.update(vendedorRef, { "equipo.titulares": titularesVend, "equipo.banquillo": banquilloVend });

          // 6️⃣ ACTUALIZAR DUEÑOS DEL JUGADOR
          tx.update(jugadorRef, {
            dueños: arrayRemove(idUsuario)
          });
          tx.update(jugadorRef, {
            dueños: arrayUnion(user.uid)
          });

          // 7️⃣ HISTORIAL
          const historialRef = doc(collection(db, "historial"));
          tx.set(historialRef, {
            tipo: "clausulazo",
            compradorUid: user.uid,
            compradorNombre: dataComprador.nick || "Usuario",
            vendedorUid: idUsuario,
            vendedorNombre: dataVendedor.nick || "Usuario",
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre,
            precio: clausulaPersonal,
            fecha: new Date(),
          });

          // 8️⃣ SACAR DEL MERCADO DE USUARIOS (Corrección de la ruta)
          if (snapMercado.exists()) {
            const ventasActivas = snapMercado.data().jugadores || [];
            const ventasLimpias = ventasActivas.filter(v => v.jugadorId !== jugador.id);
            tx.update(mercadoUsuariosRef, { jugadores: ventasLimpias });
          }
          
          // BORRAR OFERTAS PENDIENTES SI LAS HABÍA
          // (Nota: No se pueden hacer queries complejas dentro de tx, pero como es secundario, 
          // lo ideal sería limpiarlas después, o dejar que tu sistema las ignore al no tener ya el vendedor el jugador).
        });

        // 9️⃣ Feedback al usuario post-transacción
        await Swal.fire({
          icon: "success",
          title: "¡Cláusula pagada!",
          html: `Has fichado a <strong>${jugador.nombre}</strong> por <strong>${clausulaPersonal.toLocaleString("es-ES")}€</strong><br/>Nueva cláusula: <strong>${Math.round(clausulaPersonal * 1.5).toLocaleString("es-ES")}€</strong>`,
          confirmButtonText: "Aceptar",
          background: "#1e1e1e",
          color: "#fff",
        });

        window.location.reload();

      } catch (error) {
        console.error("Error al pagar cláusula:", error);
        
        let mensajeError = "No se pudo completar el pago de la cláusula.";
        if (error.message === "EQUIPO_LLENO") mensajeError = "No tienes hueco en tu plantilla para fichar a este jugador.";
        if (error.message === "SIN_DINERO") mensajeError = "No tienes suficiente dinero para pagar esta cláusula.";

        await Swal.fire({
          icon: "error",
          title: "Error",
          text: mensajeError,
          confirmButtonText: "Ok",
        });
      }
    };

  const hacerOferta = async () => {
        if (!jugador || !user) return;
    
        if (!edicionActiva) {
          await Swal.fire({
            icon: "error",
            title: "Jornada Empezada",
            text: "No se puede vender con la jornada empezada.",
            confirmButtonText: "Ok",
          });
          return;
        }
    
        const ventaInmediata = Math.round(jugador.precio * 0.6);
    
        const userRef = doc(db, "usuarios", user.uid);
        const jugadorRef = doc(db, "jugadores", jugador.id);
        const mercadoUsuariosRef = doc(db, "mercadoUsuarios", "actual");
    
        try {
          await runTransaction(db, async (tx) => {
            // 1️⃣ LECTURAS (Siempre primero)
            const snapUser = await tx.get(userRef);
            const snapMercado = await tx.get(mercadoUsuariosRef);

            if (!snapUser.exists()) {
              throw new Error("Usuario no encontrado.");
            }

            const dataUser = snapUser.data();

            // 2️⃣ ACTUALIZAR DINERO Y PLANTILLA
            const titulares = (dataUser.equipo?.titulares || []).map(j =>
              j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
            );
            const banquillo = (dataUser.equipo?.banquillo || []).map(j =>
              j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
            );

            tx.update(userRef, {
              dinero: (dataUser.dinero || 0) + ventaInmediata,
              "equipo.titulares": titulares,
              "equipo.banquillo": banquillo,
            });

            // 3️⃣ ACTUALIZAR STOCK Y DUEÑOS DEL JUGADOR
            tx.update(jugadorRef, {
              stockLibre: increment(1),
              dueños: arrayRemove(user.uid),
            });

            // 4️⃣ SACAR DEL MERCADO DE USUARIOS (Por si el usuario lo tenía en venta)
            if (snapMercado.exists()) {
              const ventasActivas = snapMercado.data().jugadores || [];
              const ventasLimpias = ventasActivas.filter(v => v.jugadorId !== jugador.id);
              tx.update(mercadoUsuariosRef, { jugadores: ventasLimpias });
            }

            // 5️⃣ GUARDAR HISTORIAL DE VENTA
            const historialRef = doc(collection(db, "historial"));
            tx.set(historialRef, {
              tipo: 'venta directa', 
              vendedorNombre: dataUser.nick || "Usuario",
              compradorNombre: 'Fantasy Casadillos', // Para que quede claro a quién se lo vendió
              jugadorNombre: jugador.nombre,
              fotoJugador: jugador?.foto || "",
              precio: ventaInmediata,
              fecha: new Date(),
            });
          });
    
          // 6️⃣ Feedback al usuario
          await Swal.fire({
            icon: "success",
            title: "¡Jugador vendido!",
            html: `Has recibido <strong>${ventaInmediata.toLocaleString("es-ES")}€</strong>`,
            confirmButtonText: "Aceptar",
            background: "#1e1e1e",
            color: "#fff",
          });
    
          window.location.reload();
    
        } catch (error) {
          console.error("Error en la venta directa:", error);
          await Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo completar la venta.",
            confirmButtonText: "Ok",
          });
        }
    };

  useEffect(() => {
    const cargarEstadoEdicionClausula = async () => {
      try {
        const ref = doc(db, "admin", "controles");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setEdicionActiva(data.edicionActiva === true);
          setClausulaPermitida(data.clausulaPermitida === true);
        }
      } catch (error) {
        console.error("Error al obtener estado de edición:", error);
      }
    };

    cargarEstadoEdicionClausula();
  }, []);

  const traducirPosicion = (pos) => {
    switch (pos) {
      case "DEF":
        return "Defensa";
      case "MED":
        return "Mediocentro";
      case "DEL":
        return "Delantero";
      case "POR":
        return "Portero";
      default:
        return pos || "Sin posición";
    }
  };

  // para cerrar al pulsar fuera
  const overlayRef = useRef()

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const formatearDinero = (valor) => {
    return valor.toLocaleString('es-ES') + '€';
  };

  const abreviarnombre = (nombre) => {
    if (!nombre) return "";

    const maxLength = 15
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
            <img src={fotoURL} alt="Jugador" />
          </label>
          <div className="modal-jugadorinfo">
            <h2>{jugador.nombre}</h2>
            <div className='posicion-precio'>
              <div className={`posicion-texto ${jugador.posicion}`}>
                <small>{traducirPosicion(jugador.posicion)}</small>
              </div>

              {/* Contenedor de precio + diferencia */}
              <div className='precio-container'>
                <div className='precio'>
                  <small><span className='texto-blanco'>Valor:</span> {formatearDinero(jugador.precio)}</small>
                </div>
                
                <div className="diferencia-precio">
                  {(() => {
                    const historial = jugador.historialPrecios || [];
                    if (historial.length === 0) return <small>(±0€)</small>;
                    const ultimoPrecio = historial[historial.length - 1].precio || 0;
                    const diferencia = jugador.precio - ultimoPrecio;
                    const signo = diferencia > 0 ? "+" : diferencia < 0 ? "-" : "±";
                    return (
                      <small className={diferencia > 0 ? "subida" : diferencia < 0 ? "bajada" : "igual"}>
                        ({signo}{formatearDinero(Math.abs(diferencia))})
                      </small>
                    );
                  })()}
                </div>

              </div>      
              <div className='precio-clausula'>
                <small><span className='texto-blanco'>Claúsula:</span> {formatearDinero(clausulaPersonal)}</small>
              </div>
              <div className='precio-clausula'>
                <small><span className='texto-blanco'>Media de puntos:</span> {
                  jugador.puntosPorJornada && jugador.puntosPorJornada.length > 0
                    ? (
                        jugador.puntosPorJornada
                          .filter(p => typeof p === "number")
                          .reduce((acc, val, _, arr) => acc + val / arr.length, 0)
                          .toFixed(2)
                      )
                    : "-"
                }</small>
              </div>
            </div>
            {/* Nuevo bloque debajo */}
            <div className="estadisticas-extra">
              {/* Últimas 5 jornadas */}
              <div className="ultimas-jornadas">
                {jugador.puntosPorJornada && jugador.puntosPorJornada.length > 0
                  ? jugador.puntosPorJornada.slice(-5).map((p, i, arr) => {
                      const puntos = p != null ? p : "-";
                      // Índice de jornada: siempre empezamos desde 1
                      const jornadaIndex = arr.length < 5 ? i + 1 : jugador.puntosPorJornada.length - 5 + i + 1;
                      // Determinar clase de color
                      let claseColor = "";
                      if (typeof p === "number") {
                        if (p >= 9) claseColor = "verde";
                        else if (p < 7) claseColor = "rojo";
                        else claseColor = "naranja";
                      }
                      return (
                        <div key={i} className="jornada-item">
                          <small className="jornada-nombre">J{jornadaIndex}</small>
                          <div className={`jornada-cuadro ${claseColor}`}>
                            {puntos}
                          </div>
                        </div>
                      );
                    })
                  : [...Array(5)].map((_, i) => (
                      <div key={i} className="jornada-item">
                        <small className="jornada-nombre">J{i + 1}</small>
                        <div className="jornada-cuadro">-</div>
                      </div>
                    ))
                }
              </div>
            </div>
          </div>
        </div>
        <hr/>
        <div className="modal-jugadorbody">
          <div className="stat-card">
            <h4>{jugador.valoracion}</h4>
            <small>Valoración</small>
          </div>
          <div className="stat-card">
            <h4>{jugador.nota}</h4>
            <small>Nota Media</small>
          </div>
          <div className="stat-card">
            <h4>{jugador.puntosTotales}</h4>
            <small>Puntos</small>
          </div>
          <div className="stat-card">
            <h4>{jugador.partidos}</h4>
            <small>Partidos</small>
          </div>
          <div className="stat-card">
            <h4>{jugador.goles}</h4>
            <small>Goles</small>
          </div>
          <div className="stat-card">
            <h4>{jugador.asistencias}</h4>
            <small>Asistencias</small>
          </div>
        </div>
        <hr/>
        <div className="modal-footer">
          <button
            className="btn-accion"
            disabled={!clausulaPermitida || !edicionActiva}
            onClick={() => {
              pagarClausula()
            }}
          >
            Pagar Cláusula
            <small className="precio-compra">
              (-{formatearDinero(jugador.precioClausula)})
            </small>
          </button>

          <button
            className="btn-accion"
            disabled={!edicionActiva}
            onClick={() => {
              hacerOferta(); // evita que se abra el modal
            }}>                      
              Hacer oferta                    
            </button>                
        </div>
      </div>
    </div>
  )
}
