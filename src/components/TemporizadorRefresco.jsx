import { useEffect, useState } from "react";

function TemporizadorRefresco() {
  const [tiempoRestante, setTiempoRestante] = useState("");

  useEffect(() => {
    const actualizarTiempo = () => {
      const ahora = new Date();
      const siguienteRefresco = new Date();
      siguienteRefresco.setHours(24, 0, 0, 0); // medianoche (00:00:00)

      const diff = siguienteRefresco - ahora;

      const horas = Math.floor(diff / (1000 * 60 * 60));
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diff % (1000 * 60)) / 1000);

      setTiempoRestante(
        `${horas.toString().padStart(2, "0")}:` +
        `${minutos.toString().padStart(2, "0")}:` +
        `${segundos.toString().padStart(2, "0")}`
      );
    };

    actualizarTiempo();
    const interval = setInterval(actualizarTiempo, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="temporizador">
      <p>Refrescar Mercado - {tiempoRestante}</p>
    </div>
  );
}

export default TemporizadorRefresco;
