import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { PlayerShell } from "./components/PlayerShell";
import { enterApp } from "./features/ui/uiSlice";

export function App() {
  const dispatch = useAppDispatch();
  const hasEntered = useAppSelector((state) => state.ui.hasEntered);
  const [isExitingWelcome, setIsExitingWelcome] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleEnter = useCallback(() => {
    if (isExitingWelcome || hasEntered) return;

    setIsExitingWelcome(true);
    timeoutRef.current = window.setTimeout(() => {
      dispatch(enterApp());
    }, 550);
  }, [dispatch, hasEntered, isExitingWelcome]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="bg-grid"></div>
      {hasEntered ? (
        <PlayerShell />
      ) : (
        <WelcomeScreen onEnter={handleEnter} isExiting={isExitingWelcome} />
      )}
    </>
  );
}
