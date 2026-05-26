import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import DataTable, {createTheme} from "react-data-table-component"; 
import appFirebase from "../credenciales";
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore'
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Clasificacion.css";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

createTheme('solarized', {
  text: {
    primary: '#268bd2',
    secondary: '#2aa198',
  },
  background: {
    default: '#002b36',
  },
  context: {
    background: '#cb4b16',
    text: '#FFFFFF',
  },
  divider: {
    default: '#073642',
  },
  action: {
    button: 'rgba(0,0,0,.54)',
    hover: 'rgba(40, 67, 165, 0.08)',
    disabled: 'rgba(188, 22, 22, 0.12)',
  },
}, 'dark');

export default function Clasificacion({ usuario }) {
  
  const getNumericPos = (pos) => parseInt(pos)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const conditionalRowStyles = [
    // Top 3 según posición
    {
      when: row => row.pos === '1º',
      style: {
        background: 'linear-gradient(135deg, rgb(255, 215, 0), rgb(218, 165, 32))',
        boxShadow: '0 0 8px rgba(255, 215, 0, 0.7), inset 0 0 4px rgba(255, 255, 255, 0.6)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 'clamp(0.9rem, 1vw + 0.3rem, 1rem)'
      }    
    },
    {
      when: row => row.pos === '2º',
      style: {
        background: 'linear-gradient(135deg, rgb(192,192,192), rgb(169,169,169))',
        boxShadow: '0 0 8px rgba(192,192,192, 0.6), inset 0 0 4px rgba(255, 255, 255, 0.5)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 'clamp(0.9rem, 1vw + 0.3rem, 1rem)'
      }    
    },
    {
      when: row => row.pos === '3º',
      style: {
        background: 'linear-gradient(135deg, rgb(205, 127, 50), rgb(139, 69, 19))',
        boxShadow: '0 0 8px rgba(205, 127, 50, 0.6), inset 0 0 4px rgba(255, 255, 255, 0.4)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 'clamp(0.9rem, 1vw + 0.3rem, 1rem)'
      }    
    },
    // Intercalado para el resto (excepto top3 y 0 puntos)
    {
      when: row => getNumericPos(row.pos) > 3 && getNumericPos(row.pos) % 2 === 0,
      style: { backgroundColor: '#002b36', color: 'white', fontWeight: 'bold', fontSize: 'clamp(0.9rem, 1vw + 0.3rem, 1rem)' }
    },
    {
      when: row => getNumericPos(row.pos) > 3 &&  getNumericPos(row.pos) % 2 === 1,
      style: { backgroundColor: '#092e37ff', color: 'white', fontWeight: 'bold', fontSize: 'clamp(0.9rem, 1vw + 0.3rem, 1rem)' }
    }
  ]


  const columns = [
    { 
      name: "Pos.",    
      selector: row => row.pos,    
      width: "4.2rem",
      center: true
    },
    { 
      name: "Jugador",
      selector: row => row.jugador,
      cell: row => (
        <Link
          to={row.id === usuario.uid ? "/home" : `/equipo/${row.id}`} // condición aquí
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          <img 
            src={row.fotoPerfil} 
            alt="Foto" 
            style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '1px solid black' }} 
          />
          <span>{row.jugador}</span>
        </Link>
      ),
    },
    { 
      name: "Puntos", 
      selector: row => row.puntos, 
      width: '5.5rem', 
      center: true
    }
  ];

  useEffect(() => {

    // Partículas
    if (window.particlesJS) {
      window.particlesJS.load('particles-js', 'particles.json', () => {
        console.log('Particles.js config cargado')
      })
      
    }
    
  }, [usuario]);

  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)

// Dentro del useEffect que carga los datos:
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
          pos: `${i + 1}º`,
          jugador: u.nick || 'Sin nombre',
          puntos: u.puntos || 0,
          fotoPerfil: u.fotoPerfil || ImagenProfile
        }))

        /* Añadir filas vacías hasta un mínimo (ej. 10)
        const minRows = 10
        while (datosConPos.length < minRows) {
          datosConPos.push({
            pos: `${datosConPos.length + 1}º`,
            jugador: 'Prueba',
            puntos: 0,
            fotoPerfil: ImagenProfile
          })
        }*/

        setTableData(datosConPos)
      } catch (error) {
        console.error('Error al cargar usuarios:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsuarios()
  }, [])

  const customStyles = {
    cells: {
      style: {
        borderRight: '1px solid rgba(255,255,255, 0.2)', // línea entre columnas
        borderBottom: '1px solid rgba(255,255,255, 0.2)', // línea en encabezado

      }
    },
    headCells: {
      style: {
        borderRight: '1px solid rgba(255,255,255,0.2)', // línea en encabezado
        backgroundColor: '#002b36',
        color: '#ffffff',
        borderTop: '1px solid rgba(255,255,255,0.2)', // línea en encabezado
        justifyContent: 'center',
        textAlign: 'center'
      }
    },
    rows: {
      style: {

      }
    }
  }

  return (
    <div>
      <Cabecera usuario={usuario} />

      <div className="login-hero-Cabecera" style={{
        backgroundImage: `url(${Fondo})`,
        display: 'block',            /* 🚀 CAMBIO CLAVE: Usamos block en lugar de flex */
        paddingTop: '3rem',          /* Distancia desde la cabecera */
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        
        <div className="container-tabla" style={{ 
          margin: '0 auto',          /* 🚀 Margen automático para centrado horizontal absoluto */
          width: '95%',              /* Ocupa casi todo el ancho en móviles */
          maxWidth: '40rem',         /* No se pasa de ancho en PC */
          textAlign: 'center', 
          position: 'relative', 
          zIndex: 1 
        }}>
          <DataTable
            title="CLASIFICACIÓN"
            columns={columns}
            data={tableData}
            fixedHeader
            fixedHeaderScrollHeight="30rem" 
            /* ⚠️ SE HA ELIMINADO EL minHeight="20rem" QUE INFLABA LA TABLA ⚠️ */
            progressPending={loading}
            progressComponent={<h1>Cargando...</h1>}
            conditionalRowStyles={conditionalRowStyles}
            customStyles={customStyles}
            striped
            highlightOnHover
            responsive
            noDataComponent={<div>No hay jugadores para mostrar</div>}
            theme="solarized"
          />
        </div>
      </div>

    </div>
  );
}
