import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import DisplayView from './DisplayView'
import './index.css'

const params = new URLSearchParams(window.location.search);
const displaySession = params.get('display');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {displaySession
      ? <DisplayView sessionId={displaySession} />
      : <App />}
  </React.StrictMode>
)
