import { useEffect, useState } from 'react'

export default function SingleTabGuard({ children }) {
  const [isDuplicate, setIsDuplicate] = useState(false)

  useEffect(() => {
    // Definimos un canal único de comunicación entre pestañas del mismo origen
    const channel = new BroadcastChannel('app_single_tab_channel')

    // 1. Al montar el componente, avisamos a las pestañas existentes que acabamos de abrirnos
    channel.postMessage({ type: 'NEW_TAB_OPENED' })

    // 2. Escuchamos los mensajes de otras pestañas
    channel.onmessage = (event) => {
      const { type } = event.data || {}

      if (type === 'NEW_TAB_OPENED') {
        // Somos la pestaña original: le respondemos a la nueva diciéndole que ya existimos
        channel.postMessage({ type: 'ALREADY_EXISTS' })
      } else if (type === 'ALREADY_EXISTS') {
        // Somos la nueva pestaña: confirmamos que ya hay otra activa
        setIsDuplicate(true)

        // Intentamos cerrar la pestaña automáticamente por si el navegador lo permite
        try {
          window.close()
        } catch (e) {
          console.warn('El navegador bloqueó window.close()', e)
        }
      }
    }

    return () => {
      channel.close()
    }
  }, [])

  // Si se detecta que esta pestaña es un duplicado, mostramos una pantalla de aviso limpia
  if (isDuplicate) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0b0e14',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        textAlign: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          background: '#161b26',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #ff004c',
          boxShadow: '0 0 20px rgba(255, 0, 76, 0.2)',
          maxWidth: '420px'
        }}>
          <h2 style={{ color: '#ff004c', marginBottom: '16px', fontSize: '1.4rem' }}>
            Sesión ya activa
          </h2>
          <p style={{ color: '#a0aec0', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Ya tienes una pestaña con la aplicación abierta en este navegador. 
          </p>
          <button
            onClick={() => window.close()}
            style={{
              background: 'linear-gradient(90deg, #ff004c, #ff4d00)',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 0 10px rgba(255, 0, 76, 0.4)'
            }}
          >
            Cerrar esta pestaña
          </button>
        </div>
      </div>
    )
  }

  // Si es la pestaña principal / única, renderizamos toda la app con normalidad
  return children
}