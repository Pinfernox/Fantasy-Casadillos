import { Link } from "react-router-dom";
import './NotFoundFallback.css'

export default function NotFoundFallback({ usuario }) {
  return (
    <main className="fallback-root" role="main">
      <div className="fallback-card" aria-live="polite">
        <div className="fallback-illustration" aria-hidden="true">
            <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0" stopColor="#06202a" />
                <stop offset="1" stopColor="#072f34" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" rx="16" fill="url(#g1)" opacity="0.12"/>
            <g transform="translate(50,40)" fill="none" stroke="#bfe7e8" strokeOpacity="0.08" strokeWidth="6">
                <path d="M0 150 C 120 10, 360 10, 480 150" strokeLinecap="round"/>
                <circle cx="120" cy="120" r="18" />
                <circle cx="360" cy="120" r="18" />
            </g>
            </svg>
        </div>

        <div className="fallback-body">
          <h1 className="fallback-title">Página no encontrada</h1>
          <p className="fallback-sub">
            Lo sentimos, la ruta que buscas no existe o ha sido movida.
            {usuario ? " Vamos a llevarte a tu panel." : " Usa el botón para volver al inicio."}
          </p>

          <div className="fallback-actions">
            <Link to={usuario ? "/home" : "/"} className="btn-primary">Volver al inicio</Link>
            {usuario && (
              <Link to="/mercado" className="btn-ghost">Ir al mercado</Link>
            )}
          </div>

          <small className="fallback-hint">Si crees que esto es un error, revisa la URL o contacta con soporte.</small>
        </div>
      </div>
    </main>
  );
}
