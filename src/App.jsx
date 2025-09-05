import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import appFirebase from "./credenciales";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Home from "./components/Home";
import Mercado from "./components/Mercado";
import Clasificacion from "./components/Clasificacion";


const auth = getAuth(appFirebase);
const firestore = getFirestore(appFirebase);

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(true); // ✅ Nuevo estado

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(firestore, "usuarios", user.uid));
          if (userDoc.exists()) {
            setUsuario({ uid: user.uid, ...userDoc.data() });
          } else {
            setUsuario({ uid: user.uid, correo: user.email, onboarding: false });
          }
        } catch (err) {
          console.error("Error obteniendo datos de usuario:", err);
          setUsuario(null);
        }
      } else {
        setUsuario(null);
      }

      setCargandoUsuario(false); // ✅ solo cuando ya terminó de cargar Firestore
    });

    return () => unsubscribe();
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

          {/* Ruta fallback */}
          <Route path="*" element={<Navigate to={usuario ? "/home" : "/"} replace />} />
      </Routes>
    </Router>

  );
}

export default App;
