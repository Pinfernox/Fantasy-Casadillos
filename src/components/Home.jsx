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
import Swal from "sweetalert2";

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
  const [titularesLocal, setTitulares] = useState(titulares);
  const [banquilloLocal, setBanquillo] = useState(banquillo);
  const [jugadores, setJugadores] = useState([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  const capitan = usuario?.equipo?.capitan || "";
  const formacionesDisponibles = Object.keys(FORMACIONES);
    // Estado inicial: la formación actual del usuario
  const [formacionActual, setFormacionActual] = useState(usuario?.equipo?.formacion || "2-1-1");
  const [formacionSeleccionada, setFormacionSeleccionada] = useState(formacionActual);
  const [guardando, setGuardando] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState(false);
  const [equipocreado, setEquipocreado] = useState(usuario?.equipocreado);
  const [openModal, setOpenModal] = useState(false)
  const [openModalJugador, setOpenModalJugador] = useState(false)
  const [menuActivo, setMenuActivo] = useState(false);
  const refMenu = useRef(null);
  const logout = () => signOut(auth);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [jugadorSeleccionadoEdicion, setJugadorSeleccionadoEdicion] = useState(null);

  const toggleModoEdicion = () => {
    setModoEdicion(!modoEdicion);
    setJugadorSeleccionadoEdicion(null); // reset al cambiar el modo
  };

  const handleClickEdicion = (jugadorId, index, tipo) => {
    if (!modoEdicion) return;

    const arrayMap = tipo === 'titulares' ? [...titularesLocal] : [...banquilloLocal];
    const jugador = arrayMap[index]; // puede ser jugador o null

    if (!jugadorSeleccionadoEdicion) {
      // primer click (aunque sea null lo dejamos marcar)
      setJugadorSeleccionadoEdicion({ jugadorId, index, tipo });
    } else {
      // segundo click → intercambio
      const { index: selIndex, tipo: selTipo } = jugadorSeleccionadoEdicion;

      // Evitamos null <-> null
      const primero = selTipo === "titulares" ? titularesLocal[selIndex] : banquilloLocal[selIndex];
      const segundo = tipo === "titulares" ? titularesLocal[index] : banquilloLocal[index];
      if (primero === null && segundo === null) {
        setJugadorSeleccionadoEdicion(null);
        return;
      }

      if (selTipo === 'titulares' && tipo === 'titulares') {
        const copia = [...titularesLocal];
        [copia[selIndex], copia[index]] = [copia[index], copia[selIndex]];
        setTitulares(copia);
      } else if (selTipo === 'banquillo' && tipo === 'banquillo') {
        const copia = [...banquilloLocal];
        [copia[selIndex], copia[index]] = [copia[index], copia[selIndex]];
        setBanquillo(copia);
      } else {
        const copiaTitulares = [...titularesLocal];
        const copiaBanquillo = [...banquilloLocal];
        if (selTipo === 'titulares') {
          [copiaTitulares[selIndex], copiaBanquillo[index]] = [copiaBanquillo[index], copiaTitulares[selIndex]];
        } else {
          [copiaBanquillo[selIndex], copiaTitulares[index]] = [copiaTitulares[index], copiaBanquillo[selIndex]];
        }
        setTitulares(copiaTitulares);
        setBanquillo(copiaBanquillo);
      }

      // Marcar cambios
      setCambiosPendientes(true);

      setJugadorSeleccionadoEdicion(null); // reset
    }
  };

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
        "equipo.formacion": formacionSeleccionada,
        "equipo.titulares": titularesLocal,
        "equipo.banquillo": banquilloLocal
      });

      setFormacionActual(formacionSeleccionada);
      setCambiosPendientes(false); // cambios guardados
    } catch (error) {
      console.error("Error al guardar formación:", error);
    } finally {
      setGuardando(false);
      setModoEdicion(false);
    }
  };

  const toggleMenu = () => {
    setMenu(!menu)
  }

  // Función para abreviar el dinero
  const formatearDinero = (valor) => {
    return valor.toLocaleString('es-ES') + '€';
  };

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

      if (jugadoresDisponibles.length < 4) {
        await Swal.fire({
          icon: "warning",
          title: "No hay suficientes jugadores disponibles",
          text: "Se necesitan al menos 4 jugadores con stock para crear un equipo.",
          confirmButtonText: "Entendido",
        });
        setGuardando(false);
        return;
      }

      // 2. Filtrar por rangos de precio
      const jugadoresCaros = jugadoresDisponibles.filter(
        (j) => j.precio > 15000000 && j.precio <= 40000000
      );
      const jugadoresBaratos = jugadoresDisponibles.filter(
        (j) => j.precio <= 15000000
      );

      let seleccionados = [];

      if (jugadoresCaros.length >= 1 && jugadoresBaratos.length >= 3) {
        // Caso ideal: 1 caro + 3 baratos
        const idxCaro = Math.floor(Math.random() * jugadoresCaros.length);
        seleccionados.push(jugadoresCaros[idxCaro]);

        for (let i = 0; i < 3; i++) {
          const idx = Math.floor(Math.random() * jugadoresBaratos.length);
          seleccionados.push(jugadoresBaratos[idx]);
          jugadoresBaratos.splice(idx, 1);
        }
      } else {
        // Respaldo: elegir 4 al azar sin superar 40M
        const jugadoresPermitidos = jugadoresDisponibles.filter(
          (j) => j.precio <= 40000000
        );

        if (jugadoresPermitidos.length < 4) {
          await Swal.fire({
            icon: "error",
            title: "No hay jugadores válidos",
            text: "No hay suficiente stock para crear un equipo bajo las condiciones establecidas.",
            confirmButtonText: "Ok",
          });
          setGuardando(false);
          return;
        }

        for (let i = 0; i < 4; i++) {
          const idx = Math.floor(Math.random() * jugadoresPermitidos.length);
          seleccionados.push(jugadoresPermitidos[idx]);
          jugadoresPermitidos.splice(idx, 1);
        }
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
        "equipo.titulares": seleccionados.map((j) => ({
          jugadorId: j.id,
          clausulaPersonal: j.clausulaInicial ?? j.precio,
        })),
        "equipo.banquillo":[
          { jugadorId: null, clausulaPersonal: null },
          { jugadorId: null, clausulaPersonal: null },
        ], 
        equipocreado: true,
      });

      setEquipocreado(true);

    } catch (error) {
      console.error("Error al crear equipo:", error);
      await Swal.fire({
        icon: "error",
        title: "Error al crear el equipo",
        text: "Inténtalo de nuevo más tarde.",
      });
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
      const allIds = [
        ...(titulares?.map(t => t?.jugadorId) || []),
        ...(banquillo?.map(b => b?.jugadorId) || []),
      ].filter(Boolean);


      if (allIds.length === 0) return;

      const jugadoresRef = collection(db, "jugadores");
      // Firestore solo permite hasta 10 IDs en un "in"
      const trozos = [];
      for (let i = 0; i < allIds.length; i += 10) {
        const subset = allIds.slice(i, i + 10);
        const q = query(jugadoresRef, where("__name__", "in", subset));
        trozos.push(getDocs(q));
      }

      const snaps = await Promise.all(trozos);
      const data = snaps.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setJugadores(data);
    };


  fetchJugadores();
  }, [usuario], [titulares, banquillo], );


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
        (<ModalPerfilJugador jugador={jugadorSeleccionado}     
          clausulaPersonal={
            usuario?.equipo?.titulares?.find(j => j.jugadorId === jugadorSeleccionado.id)?.clausulaPersonal ??
            usuario?.equipo?.banquillo?.find(j => j.jugadorId === jugadorSeleccionado.id)?.clausulaPersonal
          } 
          openModal= {openModalJugador} setOpenModal={setOpenModalJugador} user={usuario} />)}

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
            {(formacionSeleccionada !== formacionActual || cambiosPendientes) && (
              <button onClick={guardarFormacion} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            )}

          </div>
          <div className="modo-edicion-buttons">
            <button onClick={toggleModoEdicion}>
              {modoEdicion ? "Desactivar modo edición" : "Activar modo edición"}
            </button>
          </div>
          <div className="campo">
            {FORMACIONES[formacionSeleccionada]?.map((pos, index) => {
            const titularSlot = titularesLocal[index];
            const jugadorId = titularSlot?.jugadorId || null;
            const clausula = titularSlot?.clausulaPersonal || null;

            const jugador = jugadores.find(j => j.id === jugadorId);

            const esSeleccionado =
                jugadorSeleccionadoEdicion?.index === index &&
                jugadorSeleccionadoEdicion?.tipo === "titulares";

              return (
                <div
                  key={jugador?.id || index}
                  className={`jugador ${modoEdicion ? 'modo-edicion' : ''} ${esSeleccionado ? 'seleccionado' : ''}`}
                  style={{ position: "absolute", top: pos.top, left: pos.left, transform: "translate(-50%, -50%)" }}
                  onClick={() => {
                    if (modoEdicion) {
                      handleClickEdicion(jugador?.id || null, index, 'titulares');
                    } else if (jugador) {
                      setOpenModalJugador(true);
                      setJugadorSeleccionado(jugador);
                    }
                  }}>
                  <div className="jugador-wrapper">
                    <img
                      src={jugador?.foto || ImagenProfile}
                      alt={jugador?.nombre || "Vacío"}
                      className="jugador-img"
                      style={getBordeEstilo(jugador, index, formacionSeleccionada).style}
                    />
                    {/* Badge en función del estado */}
                    {(() => {
                      const { status } = getBordeEstilo(jugador, index, formacionSeleccionada);
                      if (!status) return null;
                      if (status === "green") return <div className="status-badge green">✓</div>;
                      if (status === "orange") return <div className="status-badge orange">!</div>;
                      if (status === "red") return <div className="status-badge red">✕</div>;
                    })()}

                    {capitan === jugador?.id && <div className="capitan-badge">C</div>}

                    {/* Badge de últimos puntos */}
                    {(() => {
                      if (!jugador?.puntosPorJornada?.length) return <div className="puntos-badge gray">-</div>;
                      const ultimosPuntos = jugador.puntosPorJornada[jugador.puntosPorJornada.length - 1];
                      if (ultimosPuntos == null) return null;

                      let claseColor = ultimosPuntos === "-" ? "gray" : ultimosPuntos < 7 ? "red" : ultimosPuntos < 9 ? "orange" : "green";
                      return <div className={`puntos-badge ${claseColor}`}>{ultimosPuntos}</div>;
                    })()}
                  </div>
                  <p className="jugador-nombre">{jugador?.nombre || "Vacío"}</p>
                </div>
              );
            })}
          </div>

          {/* --- BANQUILLO --- */}
          <div className="banquillo-section">
            <h3 className="banquillo-title">⚽ Banquillo</h3>
            <div className="banquillo-container">
              {banquilloLocal.map((slot, idx) => {
                const jugadorId = slot?.jugadorId || null;
                const jugador = jugadores.find(j => j.id === jugadorId);
                const esSeleccionado =
                  jugadorSeleccionadoEdicion?.index === idx &&
                  jugadorSeleccionadoEdicion?.tipo === "banquillo";

                return (
                  <div
                    key={jugador?.id || idx}
                    className={`banquillo-slot ${modoEdicion ? 'modo-edicion' : ''} ${esSeleccionado ? 'seleccionado' : ''}`}
                    onClick={() => {
                      // Intercambio si estamos en modo edición
                      if (modoEdicion) {
                        handleClickEdicion(jugador?.id || null, idx, 'banquillo');
                      } else if (jugador) {
                        setOpenModalJugador(true);
                        setJugadorSeleccionado(jugador);
                      }
                    }}
                  >
                    {jugador ? (
                      <>
                        <div className="jugador-wrapper">
                          <img
                            src={jugador?.foto || ImagenProfile}
                            alt={jugador?.nombre || "Vacío"}
                            className="jugador-img"
                          />
                          {capitan === jugador?.id && <div className="capitan-badge">C</div>}

                          {/* Badge de últimos puntos */}
                          {(() => {
                            if (!jugador?.puntosPorJornada?.length) return <div className="puntos-badge gray">-</div>;
                            const ultimosPuntos = jugador.puntosPorJornada[jugador.puntosPorJornada.length - 1];
                            if (ultimosPuntos == null) return null;
                            let claseColor = ultimosPuntos === "-" ? "gray" : ultimosPuntos < 7 ? "red" : ultimosPuntos < 9 ? "orange" : "green";
                            return <div className={`puntos-badge ${claseColor}`}>{ultimosPuntos}</div>;
                          })()}
                        </div>
                        <p className="jugador-nombre-banquillo">{jugador?.nombre}</p>
                      </>
                    ) : (
                      // Slot vacío, “+”
                      <Link
                        to={modoEdicion ? "#" : "/mercado"}  // no navegar en modo edición
                        className={`banquillo-add ${modoEdicion ? "disabled" : ""}`}
                        onClick={(e) => {
                          if (modoEdicion) e.preventDefault(); // evita navegación
                        }}
                      >
                        +
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
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
