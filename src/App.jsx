import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import appFirebase from "./credenciales";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Home from "./components/Home";
import Mercado from "./components/Mercado";
import Clasificacion from "./components/Clasificacion";
import EquipoJugador from "./components/EquipoJugador";
import Historial from "./components/Historial";
import NotFoundFallback from "./fallback/NotFoundFallback";
import { verificarRefrescoMercado } from "./utils/mercadoService";
import { refrescarMercado } from "./utils/mercadoUtils";
import { ofertasAutomaticas } from "./utils/mercadoUtils";
import EquipoJornada from "./components/EquipoJornada";
import OtrosUsuarios from "./components/OtrosUsuarios";

const auth = getAuth(appFirebase);
const firestore = getFirestore(appFirebase);

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(true); // ✅ Nuevo estado

  useEffect(() => {
      let unsubscribeSnapshot = null; // Para guardar el "micrófono abierto"

      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          // 2️⃣ LA MAGIA DEL TIEMPO REAL
          unsubscribeSnapshot = onSnapshot(
            doc(firestore, "usuarios", user.uid),
            (userDoc) => {
              if (userDoc.exists()) {
                setUsuario({ uid: user.uid, ...userDoc.data() });
              } else {
                setUsuario({ uid: user.uid, correo: user.email, onboarding: false });
              }
              setCargandoUsuario(false); // Ya tenemos los datos
            },
            (err) => {
              console.error("Error obteniendo datos de usuario:", err);
              setUsuario(null);
              setCargandoUsuario(false);
            }
          );
        } else {
          // Si no hay usuario logueado
          setUsuario(null);
          setCargandoUsuario(false);
          if (unsubscribeSnapshot) unsubscribeSnapshot(); 
        }
      });

      // Limpiamos todo si el componente se desmonta
      return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      };
    }, []);

  
  useEffect(() => {
    // 👇 declaramos la función interna de refresco
    const refrescar = async () => {
      const seHaRefrescado = await verificarRefrescoMercado(refrescarMercado);

      // Si realmente hubo refresco, lanzamos ofertas
      if (seHaRefrescado) {
        await ofertasAutomaticas();
      }
    };

    // 👇 escuchamos el cambio de autenticación
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await refrescar(); // ejecutamos solo cuando el usuario esté listo
      }
    });

    // 👇 cleanup del listener
    return () => unsub();
  }, []);



  if (cargandoUsuario) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "black",
          color: "white",
          fontSize: "1.5rem",
        }}
      >
        Cargando datos de usuario...
      </div>
    );
  }

  return (
    <Router>
        <Routes>
          {/* Login */}
          <Route path="/" element={usuario ? <Navigate to="/home" replace /> : <Login />} />

          {/* Home */}
          <Route
            path="/home"
            element={usuario ? <Home usuario={usuario} /> : <Navigate to="/" replace />}
          />
          <Route 
            path="/mercado" 
            element={usuario ? <Mercado usuario={usuario}/> : <Navigate to="/" replace />} />
          <Route 
            path="/clasificacion" 
            element={usuario ? <Clasificacion usuario={usuario}/> : <Navigate to="/" replace />} />
            
          <Route
            path="/equipo/:jugadorId"
            element={usuario ? <EquipoJugador usuario={usuario}/> : <Navigate to="/" replace/>} />
          <Route 
            path="/jornada/:jugadorId" 
            element={usuario ? <EquipoJornada usuario={usuario}/> : <Navigate to="/" replace/>} />
          <Route 
            path="/otros-usuarios" 
            element={usuario ? <OtrosUsuarios usuario={usuario}/> : <Navigate to="/" replace/>} />

          <Route 
            path="/historial" 
            element={usuario ? <Historial usuario={usuario}/> : <Navigate to="/" replace />} />
              
          {/* Ruta fallback */}
          <Route path="*" element={<NotFoundFallback usuario={usuario} />} />
      </Routes>
    </Router>

  );
}

export default App;
