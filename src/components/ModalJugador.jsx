import React, { useState, useEffect, useRef } from 'react'
import Swal from 'sweetalert2';
import './ModalJugador.css'
import { getAuth, updateProfile, updateEmail, updatePassword, deleteUser, EmailAuthProvider, 
  GoogleAuthProvider, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup, sendPasswordResetEmail} from 'firebase/auth'
import { collection, query, where, deleteDoc, getFirestore, doc, updateDoc, setDoc ,getDoc, getDocs, arrayRemove, arrayUnion, increment, addDoc,serverTimestamp  } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import ImagenProfile from '/SinPerfil.jpg'
import appFirebase from "../credenciales";

export default function ModalPerfilJugador({ jugador, clausulaPersonal, openModal, setOpenModal, user, edicionActiva }) {
  const auth = getAuth()
  const db = getFirestore(appFirebase)
  const storage = getStorage()
  const fotoURL = jugador?.foto || ImagenProfile
  const [capitanId, setCapitanId] = useState(null)
  const usuario = auth.currentUser; // usuario comprador (quien ficha)

  const [yaEnVenta, setYaEnVenta] = useState(false);

  useEffect(() => {
    const comprobarVenta = async () => {
      try {
        const ref = doc(db, "mercadoUsuarios", "actual");
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setYaEnVenta(false);
          return;
        }

        const datos = snap.data();
        const jugadores = datos.jugadores || [];

        const encontrado = jugadores.some(j => j.jugadorId === jugador.id);
        setYaEnVenta(encontrado);
      } catch (error) {
        console.error("Error al comprobar venta:", error);
        setYaEnVenta(false);
      }
    };

    if (jugador?.id) comprobarVenta();
  }, [jugador]);


  const venta = async () => {
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
        vendedorUid: usuario.uid,
        vendedorNick: user.nick,
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
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


// función que añade el jugador al mercado de usuarios
  const ponerEnMercado = async (jugador, precioVenta) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuario no autenticado");

      const usuarioRef = doc(db, "usuarios", user.uid);
      const snap = await getDoc(usuarioRef);
      const datosUsuario = snap.data();

      if (!datosUsuario) throw new Error("No se encontró el usuario en Firestore");

      const jugadorEnVenta = {
        jugadorId: jugador.id,
        precioVenta,
        vendedorUid: user.uid,
        vendedorNick: datosUsuario.nick,
        fecha: new Date().toISOString() 
      };

      const mercadoRef = doc(db, "mercadoUsuarios", "actual");

      await setDoc(
        mercadoRef,
        {
          jugadores: arrayUnion(jugadorEnVenta),
          ultimaActualizacion: serverTimestamp(),
        },
        { merge: true } // 🔥 crea el documento si no existe
      );

      await Swal.fire({
        icon: "success",
        title: "¡Jugador puesto en venta!",
        confirmButtonText: "Aceptar",
        background: "#1e1e1e",
        color: "#fff",
      });
    } catch (error) {
      console.error("Error al poner en mercado:", error);
    }
  };

  const handleVenta = () => {
    const ventaInmediata = Math.round(jugador.precio * 0.6); // redondea al entero más cercano

    Swal.fire({
      title: "¿Cómo quieres vender?",
      showDenyButton: true,
      confirmButtonText: "💰 Poner en el Mercado",
      denyButtonText: `Venta Directa\n(<span style="color:#2ecc71">+${ventaInmediata.toLocaleString("es-ES")}€</span>)`,
      confirmButtonColor: "#28a745",
      denyButtonColor: "#4878a4ff",
      background: "#1e1e1e",
      scrollbarPadding: false, // <--- evita la franja blanca por scrollbar
      color: "#fff",
    }).then(async (result) => {
      if (result.isConfirmed) {
        // segundo alerta para pedir precio
        const { value: precio } = await Swal.fire({
          title: "Introduce el precio de venta",
          input: "number",
          inputLabel: "Precio en €",
          inputPlaceholder: "Ej: 5.000.000",
          confirmButtonText: "Poner en venta",
          cancelButtonText: "Cancelar",
          showCancelButton: true,
          background: "#1e1e1e",
          scrollbarPadding: false, // <--- evita la franja blanca por scrollbar
          color: "#fff",
          inputValidator: (value) => {
            if (!value || value <= 0) {
              return "Debes introducir un precio válido";
            }
            if (value < jugador.precio) {
              return "Debes introducir un precio que sea mínimo superior al valor de mercado";
            }
          },
        });

        if (precio) {
          console.log("Venta en mercado por", precio);
          ponerEnMercado(jugador, parseInt(precio, 10));
        }

      } else if (result.isDenied) {
        console.log("Venta directa por", ventaInmediata);
        venta();
      }
    });
  };

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

  useEffect(() => {
    const fetchCapitan = async () => {
      if (!user) return
      const userRef = doc(db, "usuarios", user.uid)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        const data = userSnap.data()
        setCapitanId(data.equipo?.capitan || null)
      }
    }
    fetchCapitan()
  }, [user, db, openModal])

  const hacerCapitan = async (jugadorId) => {
    try {
      const userRef = doc(db, "usuarios", user.uid)
      await updateDoc(userRef, { "equipo.capitan": jugadorId })
      setCapitanId(jugadorId)
      await Swal.fire({
        icon: "success",
        title: "¡Capitán asignado!",
        text: `${jugador.nombre} ahora es tu capitán.`,
        confirmButtonColor: "#28a745"
      })
    } catch (err) {
      console.error("Error al asignar capitán:", err)
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo asignar el capitán, inténtalo de nuevo."
      })
    }finally{
      window.location.reload();
    }
  }

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
          {!edicionActiva ? (
            <button className="btn-accion" disabled>
              🔒 Jornada empezada
            </button>
          ) : (
            <>
              {yaEnVenta ? (
                <button className="btn-accion" disabled>
                  Ya está en venta
                </button>
              ) : (
                <button
                  className="btn-accion"
                  onClick={() => handleVenta()}
                >
                  Vender
                </button>
              )}

              <button
                className="btn-capitan"
                disabled={capitanId === jugador.id}
                onClick={() => hacerCapitan(jugador.id)}
              >
                {capitanId === jugador.id ? "Ya es capitán" : "Nombrar capitán"}
              </button>
            </>
          )}
        </div>


      </div>
    </div>
  )
}
