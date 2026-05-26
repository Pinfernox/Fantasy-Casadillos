import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import appFirebase from "../credenciales";
import { getAuth, signOut } from "firebase/auth";
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
import ImagenProfile from "/SinPerfil.jpg";
import Fondo from "../assets/fondo.png";
import "./Historial.css";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Historial({ usuario }) {
  const [historial, setHistorial] = useState([]);
  const fotoURL = usuario?.fotoPerfil || ImagenProfile;

// Cargar historial desde Firestore
  useEffect(() => {
    if (window.particlesJS) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }

    const cargarHistorial = async () => {
      try {
        const snap = await getDocs(collection(db, "historial"));
        if (!snap.empty) {
          const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // 🔹 Enriquecer cada entrada con los datos actuales
          const enriquecidos = await Promise.all(
            data.map(async (h) => {
              let jugador = {};
              let comprador = {};
              let vendedor = {};

              // jugador
              if (h.jugadorId) {
                const refJugador = doc(db, "jugadores", h.jugadorId);
                const snapJugador = await getDoc(refJugador);
                if (snapJugador.exists()) jugador = snapJugador.data();
              }

              // comprador
              if (h.compradorUid) {
                const refComprador = doc(db, "usuarios", h.compradorUid);
                const snapComprador = await getDoc(refComprador);
                if (snapComprador.exists()) comprador = snapComprador.data();
              }

              // vendedor
              if (h.vendedorUid) {
                const refVendedor = doc(db, "usuarios", h.vendedorUid);
                const snapVendedor = await getDoc(refVendedor);
                if (snapVendedor.exists()) vendedor = snapVendedor.data();
              }

              return {
                ...h,
                jugadorNombre: jugador?.nombre || "Jugador desconocido",
                fotoJugador: jugador?.foto || ImagenProfile,
                compradorNombre: comprador?.nick || "Desconocido",
                vendedorNombre: vendedor?.nick || "Fantasy Casadillos",
              };
            })
          );

          // orden descendente por fecha
          const ordenado = enriquecidos.sort(
            (a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0)
          );

          setHistorial(ordenado);
        } else {
          setHistorial([]);
        }
      } catch (error) {
        console.error("Error cargando historial:", error);
        setHistorial([]);
      }
    };

    cargarHistorial();
  }, [usuario]);


  const formatearDinero = (valor) => {
    if (typeof valor !== "number" || isNaN(valor)) return "—";
    return valor.toLocaleString("es-ES") + "€";
  };

  return (
    <div>
      <Cabecera usuario={usuario} />

      <div
        className="login-hero-Cabecera"
        style={{ backgroundImage: `url(${Fondo})` }}
      >
        <div id="particles-js" style={{ position: "absolute", inset: 0 }}></div>
        <div className="tabs-wrapper">
          <div className="tabs-container">
            <button className="tab-btn active">Historial de transacciones</button>
          </div>

          <div className="historial-container">
            {historial.length === 0 ? (
              <div className="sin-historial">
                <p>🕒 Todavía no ha habido ninguna transacción</p>
              </div>
            ) : (
              <ul className="lista-historial">
                {historial.map((h) => {
                  let mensaje;
                  let backgroundColor = "#2c2c2c"; // color neutro por defecto

                  if (h.tipo === "venta directa") {
                    backgroundColor = "rgba(59, 1, 1, 0.64)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.vendedorNombre}</strong> ha vendido de forma rápida a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.jugadorNombre}</strong> por{" "}
                        <strong style={{ color: "#e74c3c" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else if (h.tipo === "clausulazo") {
                    backgroundColor = "rgba(0, 67, 6, 0.64)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha pagado la cláusula de{" "}
                        <strong style={{ color: "#2ecc71" }}>{h.jugadorNombre}</strong> a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.vendedorNombre}</strong> por{" "}
                        <strong style={{ color: "#2ecc71" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else {
                    backgroundColor = "rgba(0, 0, 0, 0.65)";
                    mensaje = (
                      <>
                        El usuario <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha pagado{" "}
                        <strong style={{ color: "#2ecc71" }}>{formatearDinero(h.precio)}</strong> por{" "}
                        <strong style={{ color: "#2ecc71" }}>{h.jugadorNombre}</strong> a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.vendedorNombre}</strong>
                      </>
                    );
                  }

                  return (
                    <li key={h.id} className="historial-item" style={{ backgroundColor }}>
                      <div className="historial-card">
                        <img src={h.fotoJugador} alt={h.jugadorNombre} className="historial-foto" />
                        <div className="historial-info">
                          <p>{mensaje}</p>
                          <small>
                            {h.fecha?.toDate ? h.fecha.toDate().toLocaleString("es-ES") : ""}
                          </small>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

            )}
          </div>
        </div>
      </div>
    </div>
  );
}
