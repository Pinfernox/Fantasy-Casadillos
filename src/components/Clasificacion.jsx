import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { getAuth } from 'firebase/auth'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Clasificacion.css";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Clasificacion({ usuario }) {
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const fetchUsuarios = async () => {
      setLoading(true)
      try {
        const colRef = collection(db, 'usuarios')
        const snap = await getDocs(colRef)
        const usuarios = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.puntos || 0) - (a.puntos || 0))

        let datosConPos = usuarios.map((u, i) => ({
          id: u.id,
          posicion: i + 1,
          jugador: u.nick || 'Sin nombre',
          puntos: u.puntos || 0,
          fotoPerfil: u.fotoPerfil || ImagenProfile
        }))

        setTableData(datosConPos)
      } catch (error) {
        console.error('Error al cargar usuarios:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsuarios()
  }, [])

  return (
    <div>
      <Cabecera usuario={usuario} />

      <div className="login-hero-Cabecera" style={{
        backgroundImage: `url(${Fondo})`,
        display: 'block',
        paddingTop: '3rem',
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        
        <div className="container-clasificacion" style={{ position: 'relative', zIndex: 1 }}>
          
          <div className="header-clasificacion">
            <h2>🏆 CLASIFICACIÓN</h2>
          </div>

          {loading ? (
            <h2 style={{ textAlign: 'center', color: 'white' }}>Cargando...</h2>
          ) : (
            <div className="lista-clasificacion">
              {tableData.map((row) => {
                // Determinar el estilo de la tarjeta y la medalla
                let clasePosicion = "normal";
                let medalla = `${row.posicion}º`;

                if (row.posicion === 1) { clasePosicion = "oro"; medalla = "🥇"; }
                else if (row.posicion === 2) { clasePosicion = "plata"; medalla = "🥈"; }
                else if (row.posicion === 3) { clasePosicion = "bronce"; medalla = "🥉"; }

                return (
                  <Link 
                    key={row.id} 
                    to={`/jornada/${row.id}`} 
                    className={`clasificacion-card ${clasePosicion} ${row.id === usuario.uid ? 'mi-usuario' : ''}`}
                  >
                    <div className="clasificacion-info-izq">
                      <div className="posicion-badge">{medalla}</div>
                      <img src={row.fotoPerfil} alt={row.jugador} className="clasificacion-avatar" />
                      <span className="clasificacion-nombre">{row.jugador} {row.id === usuario.uid && "(Tú)"}</span>
                    </div>
                    <div className="clasificacion-puntos">
                      <span className="puntos-numero">{row.puntos}</span>
                      <span className="puntos-texto">pts</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}