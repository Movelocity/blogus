import { useEffect } from "react";
import { useNavigate } from "react-router";

export function SessionWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleExpired() {
      navigate("/login", { replace: true });
    }
    window.addEventListener("blogus:session-expired", handleExpired);
    return () => window.removeEventListener("blogus:session-expired", handleExpired);
  }, [navigate]);

  return null;
}
