import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2';
import { useNavigate } from "react-router-dom";
import Imagen from '../assets/fondo.png'
import ImagenProfile from '/SinPerfil.jpg'
import ImagenLogo from '../assets/logo.png'
import googleLogo from '../assets/google.png'
import ojoAbierto from '../assets/ojoabierto.png';
import ojoCerrado from '../assets/ojocerrado.png';
import './Login.css'

import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import appFirebase from '../credenciales.js';

const auth = getAuth(appFirebase)
const firestore = getFirestore(appFirebase)
const googleProvider = new GoogleAuthProvider()

export const Login = () => {
  const [verPassword, setVerPassword] = useState(false);
  const [registrando, setRegistrando] = useState(false)
  const [preview, setPreview] = useState(ImagenLogo)
  const navigate = useNavigate();

  useEffect(() => {
    if (window.particlesJS) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado")
      })
    }
  }, [])

  const funcAutenticacion = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const correo = form.get('email');
    const contraseña = form.get('password');

    if (registrando) {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, correo, contraseña);
        const nick = form.get('nick');

        await updateProfile(auth.currentUser, {
          displayName: nick,
        });

        const userData = {
          nick,
          correo,
          puntos: 0,
          rol: 'usuario',
          dinero: 100000000,
          equipo: {
            formacion: "2-1-1",
            titulares: [null, null, null, null], 
            banquillo: [null, null],
            capitan: null
          },
          fotoPerfil: "https://res.cloudinary.com/drmoefeeq/image/upload/v1757670238/SinPerfil_w61dic.jpg",
          puntuaciones: [],
          onboarding: false,
          equipocreado: false,
          creadoEn: new Date().toISOString(),
        };

        await setDoc(doc(firestore, "usuarios", user.uid), userData, { merge: true });


        // navigate("/home")

      } catch (error) {
        console.error("Error registrando usuario:", error);

        let mensaje = 'No se pudo crear la cuenta. Revisa los datos.';
        if (error.code === 'auth/email-already-in-use') {
          mensaje = 'Ya existe una cuenta con este correo.';
        } else if (error.code === 'auth/weak-password') {
          mensaje = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
          mensaje = 'El correo electrónico no es válido.';
        } else {
          mensaje = `Error desconocido: ${error.code}`;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: mensaje
        });
      }
    } else {
      // Inicio de sesión
      try {
        await signInWithEmailAndPassword(auth, correo, contraseña);
        console.log("Inicio de sesión exitoso");
        navigate("/home")

        // App.jsx detectará el cambio de estado y cargará los datos
      } catch (error) {
        console.error("Error iniciando sesión:", error);

        let mensaje = 'Error al iniciar sesión.';
        if (
          error.code === 'auth/invalid-credential' ||
          error.code === 'auth/wrong-password' ||
          error.code === 'auth/user-not-found'
        ) {
          mensaje = 'Correo o contraseña incorrectos.';
        }

        Swal.fire({
          icon: 'error',
          title: 'Error al iniciar sesión',
          text: mensaje
        });
      }
    }
  };

  const recuperarContrasena = async () => {
    const { value: email } = await Swal.fire({
      title: 'Recuperar contraseña',
      input: 'email',
      inputLabel: 'Introduce tu correo electrónico',
      inputPlaceholder: 'correo@ejemplo.com',
      confirmButtonText: 'Enviar enlace',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'El correo es obligatorio'
        }
      }
    })

    if (email) {
      try {
        await sendPasswordResetEmail(auth, email)
        Swal.fire('¡Correo enviado!', 'Revisa tu bandeja de entrada o bandeja de spam', 'success')
      } catch (error) {
        Swal.fire('Error', error.message, 'error')
      }
    }
  }

  const loginConGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result?.user) throw new Error("No se obtuvo el usuario de Google.");

      const user = result.user;
      const userRef = doc(firestore, "usuarios", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          nick: user.displayName || '',
          correo: user.email,
          puntos: 0,
          rol: 'usuario',
          dinero: 100000000,
          equipo: {
            formacion: "2-1-1",
            titulares: [null, null, null, null], 
            banquillo: [null, null],
            capitan: null
          },
          fotoPerfil: "https://res.cloudinary.com/drmoefeeq/image/upload/v1757670238/SinPerfil_w61dic.jpg",
          puntuaciones: [],
          onboarding: false,
          equipocreado: false,
          creadoEn: new Date().toISOString()
        });
      }

      // Solo entonces navegamos
      //navigate("/home");

    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error("Error en loginConGoogle:", error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo iniciar sesión con Google'
      });
    }
  };


  return (
    <div className="login-hero" style={{
      minHeight: '100vh',
      backgroundImage: `url(${Imagen})`,
      backgroundSize: 'cover',
      backgroundColor: 'black',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
      <div className="form-card" style={{ textAlign: 'center' }}>
        <div
          className="text-app"
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            color: 'lightblue',
            textShadow: '0 0 10px rgba(0,0,255,0.7)'
          }}
        >
          BIENVENIDO AL FANTASY CASADILLOS
        </div>

        <div style={{ position: 'relative', display: 'inline-block', textAlign: 'center' }}>
          <label style={{ cursor: 'default', display: 'inline-block' }}>
            <img src={preview} alt="Foto de Logo" className="estilo-profile" />
          </label>
        </div>

        <form onSubmit={funcAutenticacion}>
          <input type="email" name="email" placeholder="Introducir email" className="cajatexto" required />
          {registrando && <input type="text" name="nick" placeholder="Introducir nombre" className="cajatexto" required />}
          <div className="cajaContainerContraseña">
            <input
              type={verPassword ? 'text' : 'password'}
              name="password"
              placeholder="Introducir contraseña"
              className="cajacontraseña"
              required
            />
            <img
              src={verPassword ? ojoAbierto : ojoCerrado}
              alt="Mostrar contraseña"
              className="toggle-password-icon"
              onClick={() => setVerPassword(v => !v)}
            />
          </div>

          {!registrando && (
            <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
              <button type="button" onClick={recuperarContrasena} className="link-style">
                ¿Has olvidado la contraseña?
              </button>
            </div>
          )}

          {registrando ? (
            <button className="btnRegistrarse" type="submit" style={{ marginTop: '1rem' }}>
              Registrarse
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                marginTop: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <button className="btnIniciarSesion" type="submit">
                Iniciar Sesión
              </button>
              <span style={{ fontWeight: 'bold', color: 'lightgray' }}>o</span>
              <button
                type="button"
                onClick={loginConGoogle}
                className="btn-google"
                style={{ width: 'auto' }}
              >
                <img src={googleLogo} alt="Google" />
                Google
              </button>
            </div>
          )}
        </form>

        <h4 className="texto">
          {registrando ? 'Si ya tienes cuenta' : 'Si no tienes cuenta'}
          <button
            className="btnswitch"
            type="button"
            onClick={() => setRegistrando(!registrando)}
          >
            {registrando ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </h4>
      </div>
    </div>
  )
}

export default Login;
