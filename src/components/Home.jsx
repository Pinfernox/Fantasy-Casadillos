import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { FORMACIONES } from './formations';
import { getAuth, signOut } from 'firebase/auth'
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import { arrayUnion } from "firebase/firestore";
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Home.css";
import ModalPerfil from "./ModalPerfil"
import ModalPerfilJugador from "./ModalJugador";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

const MAPA_FORMACIONES = {
  "1-1-1-1": ["DEL", "MED", "DEF", "POR"],
  "2-2": ["MED", "MED", "DEF", "DEF"],
  "1-2-1 A": ["DEL", "DEF", "DEF", "POR"],
  "1-2-1 B": ["DEL", "MED", "MED", "DEF"],
  "2-1-1": ["DEL", "MED", "DEF", "DEF"],
  "1-1-2": ["MED", "MED", "DEF", "POR"],
};

function getBordeEstilo(jugador, index, formacion) {
  let color = "white"; // por defecto
  let status = null;

  if (!jugador) return { style: { borderColor: color }, status };

  const esperado = MAPA_FORMACIONES[formacion]?.[index];

  if (!esperado) return { style: { borderColor: color }, status };

  const pos = jugador.posicion; // debe ser "POR", "DEF", "MED" o "DEL"

  // Reglas de colores
  if (pos === "POR") {
    color = esperado === "POR" ? "green" : "red";
  } else if (pos === "DEF") {
    if (esperado === "DEF") color = "green";
    else if (esperado === "MED") color = "orange";
    else color = "red"; // si está en DEL o POR
  } else if (pos === "MED") {
    if (esperado === "MED") color = "green";
    else if (esperado === "DEF" || esperado === "DEL") color = "orange";
    else color = "red"; // si está en POR
  } else if (pos === "DEL") {
    if (esperado === "DEL") color = "green";
    else if (esperado === "MED") color = "orange";
    else color = "red"; // si está en DEF o POR
  }

  status = color; // guardamos el estado

  return {
    style: {
      borderColor: color,
      borderWidth: "3px",
      borderStyle: "solid",
    },
    status,
  };
}

export default function Home({ usuario }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const [menu, setMenu] = useState(false)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const titulares = usuario?.equipo?.titulares || [];
  const banquillo = usuario?.equipo?.banquillo || [];
  const [jugadores, setJugadores] = useState([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  const capitan = usuario?.equipo?.capitan || "";
  const formacionesDisponibles = Object.keys(FORMACIONES);
    // Estado inicial: la formación actual del usuario
  const [formacionActual, setFormacionActual] = useState(usuario?.equipo?.formacion || "2-1-1");
  const [formacionSeleccionada, setFormacionSeleccionada] = useState(formacionActual);
  const [guardando, setGuardando] = useState(false);
  const [equipocreado, setEquipocreado] = useState(usuario?.equipocreado);
  const [openModal, setOpenModal] = useState(false)
  const [openModalJugador, setOpenModalJugador] = useState(false)
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

  const handleSelect = (e) => {
    setFormacionSeleccionada(e.target.value);
  };

  const guardarFormacion = async () => {
    try {
      setGuardando(true);
      const userRef = doc(db, "usuarios", usuario.uid);
      await updateDoc(userRef, {
        "equipo.formacion": formacionSeleccionada
      });
      setFormacionActual(formacionSeleccionada);
    } catch (error) {
      console.error("Error al guardar formación:", error);
    } finally {
      setGuardando(false);
    }
  };

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

// --- Función para crear equipo ---
  const crearEquipo = async () => {
    try {
      setGuardando(true);

      // 1. Traer jugadores con stockLibre > 0
      const jugadoresSnap = await getDocs(collection(db, "jugadores"));
      let jugadoresDisponibles = [];
      jugadoresSnap.forEach((docu) => {
        const data = docu.data();
        if (data.stockLibre > 0) {
          jugadoresDisponibles.push({ id: docu.id, ...data });
        }
      });
      console.log(jugadoresDisponibles.length)
      if ("Jugadores disponibles", jugadoresDisponibles.length < 4) {
        alert("No hay suficientes jugadores disponibles");
        setGuardando(false);
        return;
      }

      // 2. Escoger 4 aleatorios
      let seleccionados = [];
      for (let i = 0; i < 4; i++) {
        const idx = Math.floor(Math.random() * jugadoresDisponibles.length);
        seleccionados.push(jugadoresDisponibles[idx]);
        jugadoresDisponibles.splice(idx, 1); // eliminar para no repetir
      }

      // 3. Actualizar jugadores seleccionados en Firestore
      const updates = seleccionados.map(async (jug) => {
        const ref = doc(db, "jugadores", jug.id);
        return updateDoc(ref, {
          stockLibre: jug.stockLibre - 1,
          dueños: arrayUnion(usuario.uid),
        });
      });

      await Promise.all(updates);

      // 4. Actualizar usuario en Firestore
      const userRef = doc(db, "usuarios", usuario.uid);
      await updateDoc(userRef, {
        "equipo.titulares": seleccionados.map((j) => j.id),
        equipocreado: true,
      });

      setEquipocreado(true);
    } catch (error) {
      console.error("Error al crear equipo:", error);
    } finally {
      setGuardando(false);
      window.location.reload();

    }
  };

  useEffect(() => {
    if (usuario && usuario?.onboarding === false) {
      setShowOnboarding(true);

      const timer = setTimeout(async () => {
        try {
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          await updateDoc(userRef, { onboarding: true });
          window.location.reload(); // refresca la página
        } catch (error) {
          console.error("Error actualizando onboarding:", error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    console.log('Foto de perfil desde Firestore o Auth:', usuario?.fotoPerfil)
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

    const fetchJugadores = async () => {
      if (!titulares || titulares.length === 0) return;

      const jugadoresRef = collection(db, "jugadores");
      // ⚠️ Firestore solo permite hasta 10 IDs en una query con "in"
      const q = query(jugadoresRef, where("__name__", "in", titulares));
      const snap = await getDocs(q);

      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJugadores(data);
  };

  fetchJugadores();
  }, [usuario], [titulares], );


  if (!equipocreado) {
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

        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="campo">
            <button
              className="crear-equipo-btn"
              onClick={crearEquipo}
              disabled={guardando} >
              {guardando ? "Creando equipo..." : "Crear equipo"}
            </button>
          </div>

        </div>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="loader">Cargando...</div>
        </div>
      )}
    </div>
    );
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
        {openModalJugador && jugadorSeleccionado &&           
        (<ModalPerfilJugador jugador={jugadorSeleccionado} openModal= {openModalJugador} setOpenModal={setOpenModalJugador} />)}

        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Selector de formaciones */}
          <div className="formacion-selector">
            <label htmlFor="formacion-select">Formación:</label>
            <select id="formacion-select" value={formacionSeleccionada} onChange={handleSelect}>
              {formacionesDisponibles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
                    {formacionSeleccionada !== formacionActual && (
              <button onClick={guardarFormacion} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            )}
          </div>

          <div className="campo">
            {/* Jugadores según formación */}
            {FORMACIONES[formacionSeleccionada]?.map((pos, index) => {
              const jugadorId = titulares[index];
              const jugador = jugadores.find(j => j.id === jugadorId);

              return (
                <div
                  key={jugador?.id || index}
                  className="jugador"
                  style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    transform: "translate(-50%, -50%)",
                  }}>
                  <div className="jugador-wrapper">
                    <img
                      src={jugador?.foto || ImagenProfile}
                      alt={jugador?.nombre || "Vacío"}
                      className="jugador-img"
                      style={getBordeEstilo(jugador, index, formacionSeleccionada).style}
                      onClick={() => {
                        setOpenModalJugador(true); 
                        setJugadorSeleccionado(jugador);
                    }}
                    />
                      {/* Badge en función del estado */}
                      {(() => {
                        const { status } = getBordeEstilo(jugador, index, formacionSeleccionada);
                        console.log(status)
                        if (!status) return null;

                        if (status === "green")
                          return <div className="status-badge green">✓</div>;
                        if (status === "orange")
                          return <div className="status-badge orange">!</div>;
                        if (status === "red")
                          return <div className="status-badge red">✕</div>;

                        return null;
                      })()}
                    {capitan === jugador?.id && (
                      <div className="capitan-badge">C</div>
                    )}
                  </div>
                  <p className="jugador-nombre">{jugador?.nombre || "Vacío"}</p>
                </div>
              );
            })}

          </div> 
        </div>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="loader">Cargando...</div>
        </div>
      )}
    </div>
  );
}
