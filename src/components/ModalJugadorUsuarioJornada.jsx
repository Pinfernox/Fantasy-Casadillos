import React, { useRef } from 'react'
import './ModalJugador.css'
import ImagenProfile from '/SinPerfil.jpg'

export default function ModalJugadorUsuarioJornada({ jugador, clausulaPersonal, openModal, setOpenModal }) {
  const fotoURL = jugador?.foto || ImagenProfile

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
                <small><span className='texto-blanco'>Claúsula en esa jornada:</span> {formatearDinero(clausulaPersonal)}</small>
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
                  
                  // Forzamos que siempre haya 5 cajas
                  const arrayToRender = [...ultimas, ...Array(emptyCount).fill(null)];
                  const offset = Math.max(0, historial.length - 5);

                  return arrayToRender.map((p, idx) => {
                    const puntos = p != null ? p : "-";
                    const jornadaIndex = offset + idx + 1;
                    
                    let claseColor = "";
                    if (typeof p === "number") {
                      if (p >= 9) claseColor = "verde";
                      else if (p < 7) claseColor = "rojo";
                      else claseColor = "naranja"; 
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
        {/* FOOTER ELIMINADO */}
      </div>
    </div>
  )
}