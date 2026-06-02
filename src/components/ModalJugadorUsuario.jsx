import React, { useState, useEffect, useRef } from 'react'
import './ModalJugador.css'
import { getAuth } from 'firebase/auth'
import Swal from 'sweetalert2';
import { 
  getFirestore, doc, onSnapshot, collection, arrayUnion, arrayRemove, addDoc, runTransaction 
} from "firebase/firestore";
import ImagenProfile from '/SinPerfil.jpg'

// 🚀 AÑADIDO: Recibimos edicionActiva correctamente en las props
export default function ModalPerfilJugadorUsuario({ jugador, clausulaPersonal, openModal, setOpenModal, idUsuario, edicionActiva }) {
  const auth = getAuth()
  const db = getFirestore()
  const fotoURL = jugador?.foto || ImagenProfile
  
  // 🚀 ELIMINADO: const [edicionActiva, setEdicionActiva] = useState(false); porque ahora nos lo pasa el padre
  const [clausulaPermitida, setClausulaPermitida] = useState(false);

  const pagarClausula = async () => {
      const user = auth.currentUser; 
      if (!jugador || !user) return;

      if (!clausulaPermitida || !edicionActiva) {
        await Swal.fire("Error", "No se pueden pagar cláusulas con la jornada empezada o bloqueada.", "error");
        return;
      }

      if (user.uid === idUsuario) {
        await Swal.fire("Error", "No puedes pagar la cláusula de tu propio jugador.", "error");
        return;
      }

      const userRef = doc(db, "usuarios", user.uid);
      const vendedorRef = doc(db, "usuarios", idUsuario);
      const jugadorRef = doc(db, "jugadores", jugador.id);
      const mercadoUsuariosRef = doc(db, "mercadoUsuarios", "actual");

      try {
        await runTransaction(db, async (tx) => {
          const snapComprador = await tx.get(userRef);
          const snapVendedor = await tx.get(vendedorRef);
          const snapMercado = await tx.get(mercadoUsuariosRef);

          if (!snapComprador.exists() || !snapVendedor.exists()) {
            throw new Error("Usuario no encontrado en la base de datos");
          }

          const dataComprador = snapComprador.data();
          const dataVendedor = snapVendedor.data();

          const yaLoTiene = 
            (dataComprador.equipo.titulares || []).some(j => j?.jugadorId === jugador.id) || 
            (dataComprador.equipo.banquillo || []).some(j => j?.jugadorId === jugador.id);
            
          if (yaLoTiene) throw new Error("YA_LO_TIENE");

          const huecoTitulares = dataComprador.equipo.titulares.findIndex(j => !j || j.jugadorId === null);
          const huecoBanquillo = dataComprador.equipo.banquillo.findIndex(j => !j || j.jugadorId === null);

          if (huecoTitulares === -1 && huecoBanquillo === -1) throw new Error("EQUIPO_LLENO");
          if ((dataComprador.dinero || 0) < clausulaPersonal) throw new Error("SIN_DINERO");

          tx.update(userRef, { dinero: (dataComprador.dinero || 0) - clausulaPersonal });
          tx.update(vendedorRef, { dinero: (dataVendedor.dinero || 0) + clausulaPersonal });

          let nuevosTitulares = [...dataComprador.equipo.titulares];
          let nuevoBanquillo = [...dataComprador.equipo.banquillo];
          const nuevaClausula = Math.round(clausulaPersonal * 1.5);

          if (huecoTitulares !== -1) {
            nuevosTitulares[huecoTitulares] = { jugadorId: jugador.id, clausulaPersonal: nuevaClausula };
          } else {
            nuevoBanquillo[huecoBanquillo] = { jugadorId: jugador.id, clausulaPersonal: nuevaClausula };
          }
          tx.update(userRef, { "equipo.titulares": nuevosTitulares, "equipo.banquillo": nuevoBanquillo });

          let titularesVend = [...dataVendedor.equipo.titulares].map(j =>
            j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
          let banquilloVend = [...dataVendedor.equipo.banquillo].map(j =>
            j?.jugadorId === jugador.id ? { jugadorId: null, clausulaPersonal: null } : j
          );
          tx.update(vendedorRef, { "equipo.titulares": titularesVend, "equipo.banquillo": banquilloVend });

          tx.update(jugadorRef, { dueños: arrayRemove(idUsuario) });
          tx.update(jugadorRef, { dueños: arrayUnion(user.uid) });

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

          if (snapMercado.exists()) {
            const ventasActivas = snapMercado.data().jugadores || [];
            const ventasLimpias = ventasActivas.filter(v => v.jugadorId !== jugador.id);
            tx.update(mercadoUsuariosRef, { jugadores: ventasLimpias });
          }
        });

        await Swal.fire({
          icon: "success",
          title: "¡Cláusula pagada!",
          html: `Has fichado a <strong>${jugador.nombre}</strong> por <strong>${clausulaPersonal.toLocaleString("es-ES")}€</strong>`,
          confirmButtonText: "Aceptar",
          background: "#1e1e1e", color: "#fff",
        });

        setOpenModal(false);

      } catch (error) {
        let mensajeError = "No se pudo completar el pago de la cláusula.";
        if (error.message === "EQUIPO_LLENO") mensajeError = "No tienes hueco en tu plantilla para fichar a este jugador.";
        if (error.message === "SIN_DINERO") mensajeError = "No tienes suficiente dinero para pagar esta cláusula.";
        if (error.message === "YA_LO_TIENE") mensajeError = "¡Ya tienes a este jugador en tu plantilla!";
        await Swal.fire("Error", mensajeError, "error");
      }
    };

  const enviarOferta = async () => {
    const user = auth.currentUser;
    if (!jugador || !user) return;

    if (!edicionActiva) {
      await Swal.fire("Error", "No se pueden hacer ofertas con la jornada empezada.", "error");
      return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    // Cambiado getDoc por onSnapshot si fuera necesario, pero getDoc para la transacción rápida está bien
    const snapUser = await getDoc(userRef); 
    if (!snapUser.exists()) return;
    const dataUser = snapUser.data();

    const yaLoTiene = 
      (dataUser.equipo?.titulares || []).some(j => j?.jugadorId === jugador.id) || 
      (dataUser.equipo?.banquillo || []).some(j => j?.jugadorId === jugador.id);
      
    if (yaLoTiene) {
      await Swal.fire("Error", "¡Ya tienes a este jugador en tu plantilla!", "error");
      return;
    }

    const huecoTitulares = (dataUser.equipo?.titulares || []).findIndex(j => !j || j.jugadorId === null);
    const huecoBanquillo = (dataUser.equipo?.banquillo || []).findIndex(j => !j || j.jugadorId === null);

    if (huecoTitulares === -1 && huecoBanquillo === -1) {
      await Swal.fire("Error", "No tienes huecos libres en tu equipo para realizar ofertas.", "error");
      return;
    }

    const { value: cantidadOferta } = await Swal.fire({
      title: 'Hacer Oferta Libre',
      input: 'number',
      inputLabel: `¿Cuánto ofreces por ${jugador.nombre}?`,
      inputPlaceholder: 'Cantidad en €',
      showCancelButton: true,
      confirmButtonText: 'Enviar Oferta',
      cancelButtonText: 'Cancelar',
      background: "#1e1e1e",
      color: "#fff",
      inputValidator: (value) => {
        if (!value || value <= 0) {
          return 'La oferta debe ser mayor que 0.';
        }
        if (parseInt(value, 10) > (dataUser.dinero || 0)) {
          return 'No tienes suficiente saldo para hacer esta oferta.';
        }
      }
    });

    if (!cantidadOferta) return; 
    const cantidadNum = parseInt(cantidadOferta, 10);

    try {
      await addDoc(collection(db, "ofertas"), {
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        fotoJugador: jugador.foto || ImagenProfile,
        vendedorId: idUsuario,
        compradorId: user.uid,
        compradorNombre: dataUser.nick || "Usuario",
        cantidad: cantidadNum,
        fecha: new Date(),
        estado: 'pendiente'
      });

      await Swal.fire("¡Oferta Enviada!", `Has ofrecido ${cantidadNum.toLocaleString('es-ES')}€ por ${jugador.nombre}. Esperando respuesta.`, "success");
      setOpenModal(false); 

    } catch (error) {
      console.error("Error al enviar oferta:", error);
      await Swal.fire("Error", "No se pudo enviar la oferta.", "error");
    }
  };

  useEffect(() => {
    // 🚀 AÑADIDO: Escuchamos en vivo si las cláusulas están permitidas. 
    // La edicionActiva ya viene del reloj inteligente del padre (EquipoJugador.jsx)
    const ref = doc(db, "admin", "controles");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setClausulaPermitida(data.clausulaPermitida === true);
      }
    });
    return () => unsubscribe();
  }, []);

  const traducirPosicion = (pos) => {
    switch (pos) {
      case "DEF": return "Defensa";
      case "MED": return "Mediocentro";
      case "DEL": return "Delantero";
      case "POR": return "Portero";
      default: return pos || "Sin posición";
    }
  };

  const overlayRef = useRef()
  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) setOpenModal(false);
  }

  const formatearDinero = (valor) => {
    if (typeof valor !== 'number') return '0€';
    return valor.toLocaleString('es-ES') + '€';
  };

  if (!openModal) return null

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-perfil">
        <button className="modal-close-btn" onClick={() => setOpenModal(false)}>×</button>

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
                    ? (jugador.puntosPorJornada.filter(p => typeof p === "number").reduce((acc, val, _, arr) => acc + val / arr.length, 0).toFixed(2))
                    : "-"
                }</small>
              </div>
            </div>
            <div className="estadisticas-extra">
              <div className="ultimas-jornadas">
                {(() => {
                  const historial = jugador.puntosPorJornada || [];
                  const ultimas = historial.slice(-5);
                  const emptyCount = 5 - ultimas.length;
                  
                  // Forzamos que siempre haya 5 cajas, rellenando con "null" las que falten
                  const arrayToRender = [...ultimas, ...Array(emptyCount).fill(null)];
                  
                  // Calculamos el desfase (si hay 6 jornadas, empezamos a contar desde la 2)
                  const offset = Math.max(0, historial.length - 5);

                  return arrayToRender.map((p, idx) => {
                    const puntos = p != null ? p : "-";
                    const jornadaIndex = offset + idx + 1;
                    
                    let claseColor = "";
                    if (typeof p === "number") {
                      if (p >= 9) claseColor = "verde";
                      else if (p < 7) claseColor = "rojo";
                      else claseColor = "naranja"; // Los 7 y 8 se pintarán de naranja
                    }
                    
                    return (
                      <div key={idx} className="jornada-item">
                        <small className="jornada-nombre">J{jornadaIndex}</small>
                        <div className={`jornada-cuadro ${claseColor}`}>{puntos}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
        <hr/>
        <div className="modal-jugadorbody">
          <div className="stat-card"><h4>{jugador.valoracion}</h4><small>Valoración</small></div>
          <div className="stat-card"><h4>{jugador.nota}</h4><small>Nota Media</small></div>
          <div className="stat-card"><h4>{jugador.puntosTotales}</h4><small>Puntos</small></div>
          <div className="stat-card"><h4>{jugador.partidos}</h4><small>Partidos</small></div>
          <div className="stat-card"><h4>{jugador.goles}</h4><small>Goles</small></div>
          <div className="stat-card"><h4>{jugador.asistencias}</h4><small>Asistencias</small></div>
        </div>
        <hr/>
        
        <div className="modal-footer" style={{ gap: '10px' }}>
          {/* 🚀 LÓGICA DE BLOQUEO VISUAL Y DE CÓDIGO */}
          {!edicionActiva ? (
            <button 
              className="btn-accion" 
              style={{ width: '100%', background: 'rgba(0, 0, 0, 0.5)', border: '1px dashed rgba(220, 53, 69, 0.6)', color: '#e74c3c', cursor: 'not-allowed', fontWeight: 'bold' }} 
              disabled={true}
            >
              🔒 Jornada Empezada
            </button>
          ) : (
            <>
              <button
                className="btn-accion"
                disabled={!clausulaPermitida}
                onClick={() => pagarClausula()}
              >
                Pagar Cláusula
                <small className="precio-compra">(-{formatearDinero(jugador.precioClausula)})</small>
              </button>

              <button
                className="btn-accion"
                style={{ background: 'linear-gradient(135deg, #1e3c72, #2a5298)' }}
                onClick={() => enviarOferta()}
              >
                Hacer Oferta Libre
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}