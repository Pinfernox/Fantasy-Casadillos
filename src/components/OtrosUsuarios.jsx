import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./OtrosUsuarios.css";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);

export default function OtrosUsuarios({ usuario }) {
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchUsuarios = async () => {
      setLoading(true)
      try {
        const colRef = collection(db, 'usuarios')
        const snap = await getDocs(colRef)
        const usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Orden alfabético
        usuarios.sort((a, b) => (a.nick || '').localeCompare(b.nick || ''))

        let datosListado = usuarios.map((u) => ({
          id: u.id,
          jugador: u.nick || 'Sin nombre',
          fotoPerfil: u.fotoPerfil || ImagenProfile
        }))

        setTableData(datosListado)
      } catch (error) {
        console.error('Error al cargar usuarios:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsuarios()
  }, [])

  // 👇 PARTÍCULAS OPTIMIZADAS
  useEffect(() => {
    if (window.particlesJS && document.getElementById("particles-js")) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }

    return () => {
      if (window.pJSDom && window.pJSDom.length > 0) {
        window.pJSDom.forEach((dom) => {
          if (dom && dom.pJS) {
            cancelAnimationFrame(dom.pJS.fn.drawAnimFrame);
            dom.pJS.fn.vendors.destroypJS();
          }
        });
        window.pJSDom = []; 
      }
    };
  }, []); 

  return (
    <div>
      <Cabecera usuario={usuario} />
      <div className="login-hero-Cabecera" style={{ backgroundImage: `url(${Fondo})`, display: 'block', paddingTop: '3rem', width: '100%', minHeight: '100vh', position: 'relative', boxSizing: 'border-box' }}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        
        <div className="container-tabla" style={{ margin: '0 auto', width: '95%', maxWidth: '35rem', position: 'relative', zIndex: 1 }}>
          
          <div className="header-rivales" style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'white' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>🏆 LOS FURBOLEROS</h2>
            <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>Cotillea las plantillas de tus rivales</p>
          </div>

          {loading ? (
            <h2 style={{ textAlign: 'center', color: 'white' }}>Cargando...</h2>
          ) : (
            <div className="lista-rivales-grid">
              {tableData.map(row => (
                <Link
                  key={row.id}
                  to={row.id === usuario.uid ? "/home" : `/equipo/${row.id}`}
                  className="rival-card"
                >
                  <div className="rival-info">
                    <img src={row.fotoPerfil} alt="Foto" className="rival-avatar" />
                    <span className="rival-nombre">{row.jugador} {row.id === usuario.uid && "(Tú)"}</span>
                  </div>
                  <div className="rival-action">
                    {/* Icono de flecha/ojo para indicar acción */}
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="M12 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}