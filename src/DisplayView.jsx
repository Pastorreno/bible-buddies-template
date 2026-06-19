import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function DisplayView({ sessionId }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!supabase || !sessionId) return;

    // Fetch initial session state
    supabase
      .from('bb_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => { if (data) { setState(data); setConnected(true); } });

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bb_sessions',
        filter: `id=eq.${sessionId}`,
      }, ({ new: row }) => {
        setState(row);
        setConnected(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const slide = state?.slides?.[state?.current_slide];
  const isBlank = state?.is_blank;

  return (
    <div style={{
      background: '#000',
      height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, "Times New Roman", serif',
      overflow: 'hidden', position: 'relative',
      padding: '6vw', boxSizing: 'border-box',
    }}>
      {/* Waiting state */}
      {!connected && (
        <p style={{ color: '#333', fontSize: '2rem', fontFamily: 'sans-serif' }}>
          Connecting to session <span style={{ color: '#555' }}>{sessionId}</span>…
        </p>
      )}

      {/* Blank screen */}
      {connected && isBlank && <div style={{ width: '100%', height: '100%' }} />}

      {/* No slide yet */}
      {connected && !isBlank && !slide && (
        <p style={{ color: '#222', fontSize: '2rem', fontFamily: 'sans-serif' }}>
          Waiting for presenter…
        </p>
      )}

      {/* Slide content */}
      {connected && !isBlank && slide && (
        <SlideDisplay slide={slide} state={state} />
      )}

      {/* Session code watermark */}
      {connected && (
        <p style={{
          position: 'absolute', bottom: 24, right: 32,
          color: '#1a1a1a', fontSize: '1rem',
          fontFamily: 'monospace', letterSpacing: '0.1em',
        }}>{sessionId}</p>
      )}
    </div>
  );
}

function SlideDisplay({ slide, state }) {
  if (slide.type === 'title') {
    return (
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p style={{
          fontSize: 'clamp(3rem, 8vw, 7rem)',
          fontWeight: 700, color: '#ffffff',
          lineHeight: 1.2, marginBottom: '1.5rem',
          fontFamily: 'Georgia, serif',
        }}>{slide.text}</p>
        {slide.subtitle && (
          <p style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)', color: '#c9a84c', letterSpacing: '0.05em' }}>
            {slide.subtitle}
          </p>
        )}
        {state?.title && state.title !== slide.text && (
          <p style={{ position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center', color: '#222', fontSize: '1.2rem', fontFamily: 'sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {state.title}
          </p>
        )}
      </div>
    );
  }

  if (slide.type === 'verse') {
    return (
      <div style={{ textAlign: 'center', width: '100%' }}>
        {state?.title && (
          <p style={{ position: 'absolute', top: 32, left: 48, color: '#222', fontSize: '1.1rem', fontFamily: 'sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {state.title}
          </p>
        )}
        <p style={{
          fontSize: 'clamp(2.2rem, 5.5vw, 5rem)',
          lineHeight: 1.5, color: '#f5f0e8',
          fontStyle: 'italic', marginBottom: '2.5rem',
        }}>
          "{slide.text}"
        </p>
        <p style={{
          fontSize: 'clamp(1.4rem, 3vw, 2.8rem)',
          color: '#c9a84c', letterSpacing: '0.06em',
          fontStyle: 'normal', fontWeight: 600,
        }}>
          — {slide.reference}
        </p>
        {slide.note && (
          <p style={{
            position: 'absolute', bottom: 56, left: 0, right: 0,
            textAlign: 'center', color: '#333',
            fontSize: 'clamp(1rem, 2vw, 1.6rem)', fontStyle: 'italic',
            fontFamily: 'sans-serif',
          }}>{slide.note}</p>
        )}
        <p style={{
          position: 'absolute', bottom: 24, left: 32,
          color: '#1a1a1a', fontSize: '1rem', fontFamily: 'sans-serif',
        }}>
          {(state?.current_slide ?? 0) + 1} / {state?.slides?.length ?? 1}
        </p>
      </div>
    );
  }

  if (slide.type === 'note') {
    return (
      <div style={{ width: '100%', maxWidth: '90vw' }}>
        {state?.title && (
          <p style={{ position: 'absolute', top: 32, left: 48, color: '#222', fontSize: '1.1rem', fontFamily: 'sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {state.title}
          </p>
        )}
        {slide.heading && (
          <p style={{
            fontSize: 'clamp(1.6rem, 3.5vw, 3.2rem)',
            color: '#c9a84c', letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 700,
            fontFamily: 'sans-serif', marginBottom: '1.5rem',
          }}>{slide.heading}</p>
        )}
        <p style={{
          fontSize: 'clamp(2rem, 5vw, 4.5rem)',
          lineHeight: 1.45, color: '#ffffff',
          fontStyle: slide.heading ? 'normal' : 'italic',
        }}>{slide.body}</p>
        <p style={{
          position: 'absolute', bottom: 24, left: 32,
          color: '#1a1a1a', fontSize: '1rem', fontFamily: 'sans-serif',
        }}>
          {(state?.current_slide ?? 0) + 1} / {state?.slides?.length ?? 1}
        </p>
      </div>
    );
  }

  return null;
}
