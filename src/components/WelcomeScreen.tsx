import { MouseEvent, useRef } from "react";
import nuveLogo from "../../logo/Nuve.logo.png";

interface WelcomeScreenProps {
  onEnter: () => void;
  isExiting: boolean;
}

export function WelcomeScreen({ onEnter, isExiting }: WelcomeScreenProps) {
  const shellRef = useRef<HTMLElement | null>(null);

  const handlePointerMove = (event: MouseEvent<HTMLElement>) => {
    const shell = shellRef.current;
    if (!shell) return;

    const rect = shell.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const offsetX = (x - centerX) / centerX;
    const offsetY = (y - centerY) / centerY;

    shell.style.setProperty("--parallax-x", `${offsetX * 24}px`);
    shell.style.setProperty("--parallax-y", `${offsetY * 18}px`);
    shell.style.setProperty("--tilt-x", `${offsetX * 2.6}deg`);
    shell.style.setProperty("--tilt-y", `${offsetY * -2.2}deg`);
  };

  const handlePointerLeave = () => {
    const shell = shellRef.current;
    if (!shell) return;

    shell.style.setProperty("--parallax-x", "0px");
    shell.style.setProperty("--parallax-y", "0px");
    shell.style.setProperty("--tilt-x", "0deg");
    shell.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <main
      ref={shellRef}
      className={`welcome-shell welcome-v2 ${isExiting ? "fade-out" : "fade-in"}`}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <div className="nuve-welcome-bg" aria-hidden="true">
        <span className="nuve-grid"></span>
        <span className="nuve-noise"></span>
        <span className="nuve-glow nuve-glow-a"></span>
        <span className="nuve-glow nuve-glow-b"></span>
        <span className="nuve-line nuve-line-a"></span>
        <span className="nuve-line nuve-line-b"></span>
        <span className="nuve-ring nuve-ring-a"></span>
        <span className="nuve-ring nuve-ring-b"></span>
      </div>

      <section className="nuve-left">
        <div className="nuve-logo-wrap" aria-label="Nuve logo">
          <div className="nuve-logo-core">
            <span className="nuve-orbit orbit-one"></span>
            <span className="nuve-orbit orbit-two"></span>
            <span className="nuve-orbit orbit-three"></span>
            <img className="nuve-logo-image" src={nuveLogo} alt="Nuve logo" />
          </div>
          <h1 className="nuve-brand">
            NUV<span>E</span>
          </h1>
          <p className="nuve-tagline">Elevate Every Note.</p>
        </div>
      </section>

      <section className="nuve-right">
        <p className="nuve-kicker">WELCOME TO THE NEW LISTENING DIMENSION</p>
        <h2 className="nuve-headline">
          Music. Motion.
          <br />
          Emotion.
        </h2>
        <p className="nuve-copy">
          A cinematic player experience designed for focus, vibe, and discovery. Fluid visuals,
          zero clutter, total control.
        </p>

        <div className="nuve-pills" aria-label="Highlights">
          <span>Global 50</span>
          <span>Smart Playlists</span>
          <span>Live Visuals</span>
          <span>YouTube Search</span>
        </div>

        <div className="nuve-cta-row">
          <button className="enter-btn nuve-enter-btn" type="button" onClick={onEnter}>
            Enter Nuve
          </button>
          <div className="nuve-eq" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, idx) => (
              <span key={`eq-${idx}`}></span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
