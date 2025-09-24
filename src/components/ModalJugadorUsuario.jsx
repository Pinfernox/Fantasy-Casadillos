import React, { useState, useEffect, useRef } from 'react'
import './ModalJugador.css'
import { getAuth} from 'firebase/auth'
import Swal from 'sweetalert2';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  getDocs, 
  query, 
  where, 
  arrayUnion,
  arrayRemove,
  addDoc
} from 'firebase/firestore';
import { getStorage} from 'firebase/storage'
import ImagenProfile from '/SinPerfil.jpg'

export default function ModalPerfilJugadorUsuario({ jugador, clausulaPersonal, openModal, setOpenModal, idUsuario }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = jugador?.foto || ImagenProfile
  const [edicionActiva, setEdicionActiva] = useState(false);
  const [clausulaPermitida, setClausulaPermitida] = useState(false);

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

  const pagarClausula = async () => {
    if (!jugador || !auth.currentUser) return;

    if (!clausulaPermitida || !edicionActiva) {
      await Swal.fire({
        icon: "error",
        title: "Jornada Empezada",
        text: "No se puede pagar clausulas un día antes de la jornada.",
        confirmButtonText: "Ok",
      });
      return;
    }

    const user = auth.currentUser; // usuario comprador (quien ficha)
    const userRef = doc(db, "usuarios", user.uid);
    const vendedorRef = doc(db, "usuarios", idUsuario); // 🔹 idUsuario = dueño actual del jugador
    const jugadorRef = doc(db, "jugadores", jugador.id);

    try {
      // 1️⃣ Obtener datos del comprador y del vendedor
      const [snapComprador, snapVendedor] = await Promise.all([
        getDoc(userRef),
        getDoc(vendedorRef)
      ]);

      if (!snapComprador.exists() || !snapVendedor.exists()) {
        throw new Error("Usuario no encontrado en la base de datos");
      }

      const dataComprador = snapComprador.data();
      const dataVendedor = snapVendedor.data();

      // 2️⃣ Verificar hueco en titulares o banquillo SOLO en la primera posición libre
      const huecoTitulares = dataComprador.equipo.titulares.findIndex(j => j.jugadorId === null);
      const huecoBanquillo = dataComprador.equipo.banquillo.findIndex(j => j.jugadorId === null);

      if (huecoTitulares === -1 && huecoBanquillo === -1) {
        await Swal.fire({
          icon: "error",
          title: "Equipo completo",
          text: "No tienes hueco en tu plantilla para fichar a este jugador.",
          confirmButtonText: "Ok"
        });
        return;
      }

      // 3️⃣ Verificar fondos del comprador
      if (dataComprador.dinero < clausulaPersonal) {
        await Swal.fire({
          icon: "error",
          title: "Fondos insuficientes",
          text: "No tienes suficiente dinero para pagar esta cláusula.",
          confirmButtonText: "Ok"
        });
        return;
      }

      // 4️⃣ Transferencia de dinero: comprador paga, vendedor recibe
      await updateDoc(userRef, {
        dinero: dataComprador.dinero - clausulaPersonal,
      });
      await updateDoc(vendedorRef, {
        dinero: dataVendedor.dinero + clausulaPersonal,
      });

      // 5️⃣ Actualizar equipo comprador: añadir jugador SOLO en la primera posición libre
      let nuevosTitulares = [...dataComprador.equipo.titulares];
      let nuevoBanquillo = [...dataComprador.equipo.banquillo];

      if (huecoTitulares !== -1) {
        nuevosTitulares[huecoTitulares] = {
          jugadorId: jugador.id,
          clausulaPersonal: Math.round(clausulaPersonal * 1.5),
        };
      } else {
        nuevoBanquillo[huecoBanquillo] = {
          jugadorId: jugador.id,
          clausulaPersonal: Math.round(clausulaPersonal * 1.5),
        };
      }

      await updateDoc(userRef, {
        "equipo.titulares": nuevosTitulares,
        "equipo.banquillo": nuevoBanquillo,
      });

      // 6️⃣ Actualizar equipo vendedor: eliminar al jugador de su plantilla
      let titularesVend = [...dataVendedor.equipo.titulares];
      let banquilloVend = [...dataVendedor.equipo.banquillo];

      titularesVend = titularesVend.map(j =>
        j.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
      );
      banquilloVend = banquilloVend.map(j =>
        j.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
      );

      await updateDoc(vendedorRef, {
        "equipo.titulares": titularesVend,
        "equipo.banquillo": banquilloVend,
      });

      // 7️⃣ Actualizar dueños del jugador → quitar vendedor y añadir comprador
      await updateDoc(jugadorRef, {
        dueños: arrayRemove(idUsuario), // 🔹 eliminar al vendedor
      });
      await updateDoc(jugadorRef, {
        dueños: arrayUnion(user.uid),   // 🔹 añadir al comprador
      });

      // 8️⃣ Registrar en historial la operación
      await addDoc(collection(db, "historial"), {
        tipo: "clausulazo",
        compradorUid: user.uid,
        compradorNombre: dataComprador.nick,
        vendedorUid: idUsuario,
        vendedorNombre: dataVendedor.nick,
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        fotoJugador: jugador?.foto || null,
        precio: clausulaPersonal,
        fecha: new Date(),
      });

      // 9️⃣ Feedback al usuario
      await Swal.fire({
        icon: "success",
        title: "¡Cláusula pagada!",
        html: `Has fichado a <strong>${jugador.nombre}</strong> por <strong>${clausulaPersonal.toLocaleString("es-ES")}€</strong><br/>Nueva cláusula: <strong>${Math.round(clausulaPersonal * 1.5).toLocaleString("es-ES")}€</strong>`,
        confirmButtonText: "Aceptar",
        background: "#1e1e1e",
        color: "#fff",
      });

      // 🔄 Refrescar vista
      window.location.reload();

    } catch (error) {
      console.error("Error al pagar cláusula:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo completar el pago de la cláusula.",
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
  
      try {
        // 1️⃣ Actualizar dinero del usuario
        await updateDoc(userRef, {
          dinero: increment(ventaInmediata),
        });
  
        // 2️⃣ Actualizar stock del jugador y dueños
        await updateDoc(jugadorRef, {
          stockLibre: increment(1),
          dueños: arrayRemove(user.uid),
        });
  
        // 3️⃣ Poner a null el jugador en titulares o banquillo
        const snapUser = await getDoc(userRef);
        if (snapUser.exists()) {
          const data = snapUser.data();
          const titulares = data.equipo.titulares.map(j =>
            j.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
          const banquillo = data.equipo.banquillo.map(j =>
            j.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
  
          await updateDoc(userRef, {
            "equipo.titulares": titulares,
            "equipo.banquillo": banquillo,
          });
        }
  
        // 4️⃣ Guardar historial de venta
        await addDoc(collection(db, "historial"), {
          tipo: 'venta directa', 
          vendedorNombre: user.nick,
          compradorNombre: '',
          jugadorNombre: jugador.nombre,
          fotoJugador: jugador?.foto,
          precio: ventaInmediata,
          fecha: new Date(),
        });
  
        // 5️⃣ Feedback al usuario
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
        console.error("Error en la venta:", error);
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo completar la venta.",
          confirmButtonText: "Ok",
        });
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
