import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { AppProvider } from './store/AppContext'
import { ToastProvider } from './components/common/Toast'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppProvider>
  </StrictMode>,
)
