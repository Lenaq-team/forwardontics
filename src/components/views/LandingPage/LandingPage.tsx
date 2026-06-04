"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronRight, Languages, LogIn, User, Stethoscope, Loader2 } from "lucide-react";
import { LightRays } from "@/components/atoms/LightRays";
import { GradientText } from "@/components/atoms/GradientText";
import { cn } from "@/lib/utils/helpers";
import { toast } from "sonner";
import emailjs from "@emailjs/browser";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const copy = {
  es: {
    title: "Mejora la postura oral de tus hijos (y su salud) con ejercicios simples",
    subtitle:
      "Transformación natural que favorece la respiración nasal, cierre correcto de la boca y un desarrollo facial más saludable.",
    cta: "Únete ahora",
    copyright: "GOPex. Todos los derechos reservados.",
    joinDialog: {
      title: "Únete a GOPex",
      description: "Completa tus datos para unirte.",
      name: "Nombre",
      email: "Correo electrónico",
      role: "Soy",
      patient: "Paciente",
      therapist: "Terapeuta",
      submit: "Enviar",
      toastSuccess: "¡Gracias! Serás contactado pronto.",
      toastSuccessDescription: "Te contactaremos pronto.",
    },
  },
  en: {
    title: "Improve your children's oral posture (and health) with simple exercises",
    subtitle:
      "Natural transformation that promotes nasal breathing, proper mouth closure and healthier facial development.",
    cta: "Join now",
    copyright: "GOPex. All rights reserved.",
    joinDialog: {
      title: "Join GOPex",
      description: "Complete your details to join.",
      name: "Name",
      email: "Email",
      role: "I am a",
      patient: "Patient",
      therapist: "Therapist",
      submit: "Submit",
      toastSuccess: "Thank you! You will be contacted shortly.",
      toastSuccessDescription: "We will contact you shortly.",
    },
  },
} as const;

type Lang = keyof typeof copy;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const LandingPage = () => {
  const [lang, setLang] = useState<Lang>("en");
  const [openJoinDialog, setOpenJoinDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", role: "" });

  const t = copy[lang];
  const formRef = useRef<HTMLFormElement>(null);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    setIsSending(true);
    emailjs.sendForm(
      "gmail",
      "template_ihfwr9d",
      form!,
      "8j1wti9FomqvN2yKv"
    ).then(() => {
      toast.success(t.joinDialog.toastSuccess, {
        description: t.joinDialog.toastSuccessDescription,
        duration: 4000,
      });
      setFormData({ name: "", email: "", role: "" });
      setOpenJoinDialog(false);
      // Reset cursor after successful submission
      setTimeout(() => {
        const event = new CustomEvent('cursor-reset');
        window.dispatchEvent(event);
      }, 100);
    }).catch((err) => {
      console.error("Error sending message:", err);
      toast.error('Error sending message', {
        description: 'Please try again.',
        duration: 5000,
      });
    }).finally(() => {
      setIsSending(false);
    });
  };
  const nextLang: Lang = lang === "es" ? "en" : "es";

  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-gradient-to-br from-main via-main/40 to-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* LightRays - background layer */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <LightRays
          raysOrigin="top-center"
          raysColor="#00ffff"
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={8.0}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.1}
          distortion={0.05}
          className="w-full h-full pointer-events-none"
        />
      </motion.div>
      {/* Content layer - in front of LightRays */}
      <motion.div
        className="absolute inset-0 z-10 flex flex-col"
        initial="hidden"
        animate="visible"
        variants={container}
      >
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start gap-3 p-4 sm:p-6">
          <motion.h1
            variants={fadeUp}
            className="text-[clamp(1.75rem,6vw+1rem,4rem)] sm:text-[clamp(2.5rem,8vw+1rem,4.5rem)] md:text-[clamp(3rem,6vw+2rem,5.5rem)] font-extrabold text-white leading-tight font-sans"
          >
            <GradientText
              colors={["#ffffff", "#bbbbbb", "#ffffff"]}
              animationSpeed={4}
              showBorder={false}
              className="flex justify-start min-w-0 text-left"
            >
              GOPex
            </GradientText>
          </motion.h1>
          <motion.div variants={slideInRight} className="flex justify-end items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(nextLang)}
              className="gap-2 text-white hover:text-white/70 hover:bg-transparent hover:cursor-pointer"
              aria-label={`Switch to ${nextLang === "es" ? "Spanish" : "English"}`}
            >
              <Languages className="h-4 w-4" />
              {nextLang.toUpperCase()}
            </Button>
            <Button
              size="sm"
              asChild
              className="gap-2 bg-accent text-white hover:bg-accent hover:accent/80 hover:cursor-pointer rounded-full min-w-[150px]"
            >
              <a href="/login" target="_blank" rel="noopener noreferrer">
                <LogIn className="h-4 w-4" />
                {lang === "es" ? "Iniciar sesión" : "Log in"}
              </a>
            </Button>
          </motion.div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col justify-center items-center md:items-start px-4 sm:px-6 md:px-10 lg:px-16 pb-12 sm:pb-16 pt-6 sm:pt-8 md:pt-12">
          <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 max-w-4xl w-full text-center md:text-start md:pl-8 md:pr-8 lg:pl-16 lg:pr-16">

            <motion.h1
              variants={fadeUp}
              className="text-[clamp(1.5rem,4vw+1rem,3.5rem)] sm:text-[clamp(1.75rem,5vw+1rem,3.75rem)] md:text-[clamp(2rem,4vw+1.5rem,4rem)] font-bold text-white leading-[1.15] tracking-tight"
            >
              {t.title}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/70 leading-relaxed max-w-2xl"
            >
              {t.subtitle}
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="pt-2 sm:pt-4 relative inline-block w-full sm:max-w-sm md:w-[min(300px,100%)]"
            >
              <Button
                size="lg"
                onClick={() => setOpenJoinDialog(true)}
                className="relative z-10 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white px-6 sm:px-8 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-semibold shadow-lg hover:shadow-xl transition-all rounded-full w-full min-h-12 sm:min-h-14 md:min-h-[60px]"
              >
                {t.cta} <ChevronRight className="w-4 h-4 shrink-0" />
              </Button>
            </motion.div>
          </div>
        </main>
      </motion.div>
      <footer className="absolute bottom-0 left-0 right-0 flex justify-center items-center p-4 sm:p-6">
        <div className="w-full mt-8">
          <p className="text-xs text-white font-thin text-center">
            &copy; {new Date().getFullYear()} {t.copyright}
          </p>
        </div>
      </footer>

      <Dialog open={openJoinDialog} onOpenChange={setOpenJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.joinDialog.title}</DialogTitle>
            <DialogDescription>{t.joinDialog.description}</DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-name">{t.joinDialog.name}</Label>
              <Input
                id="join-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                placeholder={t.joinDialog.name}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-email">{t.joinDialog.email}</Label>
              <Input
                id="join-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t.joinDialog.email}
                required
              />
            </div>
            <input type="hidden" name="type" value={formData.role} readOnly />
            <div className="flex flex-col gap-2">
              <Label>{t.joinDialog.role}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.role === "PATIENT" ? "default" : "outline"}
                  className={cn(
                    "flex-1 gap-2",
                    formData.role === "PATIENT" && "bg-accent hover:bg-accent/90 text-white"
                  )}
                  onClick={() => setFormData({ ...formData, role: "PATIENT" })}
                  aria-pressed={formData.role === "PATIENT"}
                >
                  <User className="h-4 w-4" />
                  {t.joinDialog.patient}
                </Button>
                <Button
                  type="button"
                  variant={formData.role === "THERAPIST" ? "default" : "outline"}
                  className={cn(
                    "flex-1 gap-2",
                    formData.role === "THERAPIST" && "bg-accent hover:bg-accent/90 text-white"
                  )}
                  onClick={() => setFormData({ ...formData, role: "THERAPIST" })}
                  aria-pressed={formData.role === "THERAPIST"}
                >
                  <Stethoscope className="h-4 w-4" />
                  {t.joinDialog.therapist}
                </Button>
              </div>
            </div>

            <DialogFooter className="flex  w-full justify-center">
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-white min-w-[150px]" disabled={!formData.name.trim() || !isValidEmail(formData.email) || !formData.role || isSending}>
                {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t.joinDialog.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
