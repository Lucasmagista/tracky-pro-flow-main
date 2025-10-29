import { motion } from "framer-motion";

// Variantes de animação reutilizáveis
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

export const slideInBottom = {
  initial: { opacity: 0, y: 50 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -50 }
};

// Transições padrão
export const defaultTransition = {
  duration: 0.3,
  ease: "easeOut" as const
};

export const slowTransition = {
  duration: 0.5,
  ease: "easeOut" as const
};

export const fastTransition = {
  duration: 0.2,
  ease: "easeOut" as const
};

// Animações para listas
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Animações para cards
export const cardHover = {
  scale: 1.02,
  y: -2,
  transition: {
    duration: 0.2,
    ease: "easeOut" as const
  }
};

export const cardTap = {
  scale: 0.98,
  transition: {
    duration: 0.1,
    ease: "easeOut" as const
  }
};

// Animações para botões
export const buttonHover = {
  scale: 1.05,
  transition: {
    duration: 0.2,
    ease: "easeOut" as const
  }
};

export const buttonTap = {
  scale: 0.95,
  transition: {
    duration: 0.1,
    ease: "easeOut" as const
  }
};

// Hook para animações condicionais
export const useConditionalAnimation = (condition: boolean) => {
  return condition ? "animate" : "initial";
};