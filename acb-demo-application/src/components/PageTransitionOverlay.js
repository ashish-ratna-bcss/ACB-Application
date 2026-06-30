import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function PageTransitionOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    setVisible(true);

    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        perspective: '1000px',
      }}
    >
      <motion.img
        src={`${process.env.PUBLIC_URL}/acb-logo.png`}
        alt="logo"
        initial={{ rotateY: -180, opacity: 0 }}
        animate={{ rotateY: 720, opacity: 1 }}
        exit={{ rotateY: 180, opacity: 0 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
        style={{
          width: '200px',
          height: '200px',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
