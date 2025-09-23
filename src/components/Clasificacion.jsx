import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import DataTable, {createTheme} from "react-data-table-component"; 
import appFirebase from "../credenciales";
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, where } from 'firebase/firestore'
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Clasificacion.css";
import ModalPerfil from "./ModalPerfil"
import ModalAdmin from './ModalAdmin'

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const [menu, setMenu] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [openModalAdmin, setOpenModalAdmin] = useState(false)
  const [menuActivo, setMenuActivo] = useState(false);
  const refMenu = useRef(null);
  const logout = () => signOut(auth);
  
    // Cerramos el menú si clicas fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (refMenu.current && !refMenu.current.contains(event.target)) {
        setMenuActivo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const toggleMenu = () => {
    setMenu(!menu)
  }

  // Función para abreviar el dinero
  const formatearDinero = (valor) => {
    if (valor >= 1_000_000) {
      return (valor / 1_000_000).toFixed(2) + 'M'
    } else if (valor >= 1_000) {
      return (valor / 1_000).toFixed(2) + 'K'
    } else {
      return valor.toFixed(2)
    }
  }

  const abreviarNick = (nick) => {
    if (!nick) return "";

    const maxLength = 10
    const firstSpace = nick.indexOf(" ");

    let corte;

    if (firstSpace !== -1 && firstSpace <= maxLength) {
      corte = firstSpace; // cortar en el espacio si está antes de 9
      return nick.slice(0, corte) + "...";
      
    } else if (nick.length > maxLength) {
      corte = maxLength-3; // cortar en 9 si es más largo

      return nick.slice(0, corte) + "...";
    } else {
      return nick; // no hace falta cortar
    }

  };

  useEffect(() => {

    // Partículas
    if (window.particlesJS) {
      window.particlesJS.load('particles-js', 'particles.json', () => {
        console.log('Particles.js config cargado')
      })
      
    }
    
    // Leer dinero de Firestore
    if (usuario) {
      const ref = doc(db, 'usuarios', usuario.uid)
      getDoc(ref).then((snap) => {
        if (snap.exists()) {
          setDinero(snap.data().dinero)
        }
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
      <header className="Cabecera">
        <div className="container-profile">

          <div className='img-profile-small' style={{ position: 'relative' }}>
            <img
              src={fotoURL}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
              alt="Foto de perfil"
              onClick={() => setMenuActivo(!menuActivo)} // toggle con clic
              onMouseEnter={() => setMenuActivo(true)} // hover
            />

            {menuActivo && (
              <div
                className="perfil-bocadillo"
                ref={refMenu}
                onMouseLeave={() => setMenuActivo(false)} // solo se cierra al salir del menú
              >
              <div className="triangulo" />
                  <button className="btn-perfil" onClick={() => { setOpenModal(true); setMenuActivo(false); }}>👤 Perfil</button>
                  
                  <button className="btn-logout" onClick={logout}>➜] Cerrar sesión</button>

                  {usuario?.rol === 'admin' && <button className="btn-admin" onClick={() => { setOpenModalAdmin(true); setMenuActivo(false); }}>⚙️ Admin</button>}
              </div>
            )}
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">
              {(usuario?.nick || usuario?.displayName)}
            </h2>
            {dinero !== null && (
              <p className="dinero-usuario">
                💰<strong>{formatearDinero(dinero)}</strong>
              </p>
            )}
          </div>
        </div>

        <button onClick={toggleMenu} className="Cabecera-button">
          <svg className='Cabecera-svg' xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
        </button>

        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          <ul className="Cabecera-ul">
            <li className="Cabecera-li">
              <Link to="/home" className="Cabecera-a">EQUIPO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/mercado" className="Cabecera-a">MERCADO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/clasificacion" className="Cabecera-a">CLASIFICACIÓN</Link>
            </li>

          </ul>
        </nav>

      </header>

        <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`,}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        {openModal && 
          (<ModalPerfil usuario={usuario} openModal= {openModal} setOpenModal={setOpenModal} />)
        }
        {openModalAdmin &&       
          (<ModalAdmin usuario={usuario} openModal= {openModalAdmin} setOpenModal={setOpenModalAdmin}/>)
        }
        <div className="container-tabla" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <DataTable
            title="CLASIFICACIÓN"
            columns={columns}
            data={tableData}
            fixedHeader
            fixedHeaderScrollHeight="30rem" // altura máxima del contenedor, ajusta como quieras
            minHeight="20rem"       /* altura mínima, ajusta a tu gusto */
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
