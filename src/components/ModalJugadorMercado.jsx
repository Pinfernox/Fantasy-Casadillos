import React, { useState, useEffect, useRef } from 'react'
import './ModalJugador.css'
import { getAuth} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage} from 'firebase/storage'
import ImagenProfile from '/SinPerfil.jpg'


export default function ModalJugadorMercado({ jugador, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = jugador?.foto || ImagenProfile

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
    if (typeof valor !== "number" || isNaN(valor)) {
      return "—"; // o "0€" si prefieres
    }
    return valor.toLocaleString("es-ES") + "€";  
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
              <div className="precio-clausula">
                <small>
                  <span className="texto-blanco">Vendedor:</span> 
                  <span style={{ color: 'lightgreen', fontWeight: 'bold', marginLeft: '4px' }}>{jugador?.vendedor}</span>
                </small>
              </div>              <div className='precio-clausula'>
                <small><span className='texto-blanco'>Media de puntos:</span> {
                  jugador.puntosPorJornada && jugador.puntosPorJornada.length > 0
                    ? (jugador.puntosPorJornada.filter(p => typeof p === "number").reduce((acc, val, _, arr) => acc + val / arr.length, 0).toFixed(2))
                    : "-"
                }</small>
              </div>
            </div>

            {/* Nuevo bloque debajo */}
            <div className="estadisticas-extra">
              {/* Últimas 5 jornadas */}
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
      </div>
    </div>
  )
}
