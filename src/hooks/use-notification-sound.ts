"use client";

import { useCallback, useState } from "react";

/**
 * Notification sound — plays a short chime when an inbound customer
 * message arrives in the inbox.
 *
 * The mute preference is device-scoped (localStorage), consistent with
 * the other personal settings in the app (theme, appearance). No server
 * round-trip needed: the sound is a local concern, not an account one.
 */
const STORAGE_KEY = "notif-sound-muted";
const SOUND_URL = "/sounds/notification.wav";

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio(SOUND_URL);
    audioEl.preload = "auto";
  }
  return audioEl;
}

function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function useNotificationSound() {
  const [muted, setMutedState] = useState<boolean>(isMuted);

  const setMuted = useCallback((next: boolean) => {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    setMutedState(next);
  }, []);

  const playIncomingMessageSound = useCallback(() => {
    if (isMuted()) return;
    const el = getAudio();
    if (!el) return;
    // Restart from the top so a burst of messages doesn't stack up.
    el.currentTime = 0;
    el.play().catch(() => {
      // Autoplay policy / no audio device — never let this throw.
    });
  }, []);

  return { muted, setMuted, playIncomingMessageSound };
}
