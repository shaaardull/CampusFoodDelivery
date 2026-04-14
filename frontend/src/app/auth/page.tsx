"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendOtp, verifyOtp, register } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/hooks/useToast";
import { Spinner } from "@/components/shared/Loaders";

type Step = "email" | "otp" | "register";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { addToast } = useToastStore();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [hostel, setHostel] = useState<"talpona" | "terekhol">("talpona");
  const [room, setRoom] = useState("");
  const [upi, setUpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await sendOtp(email);
      if (res.dev_otp) setDevOtp(res.dev_otp);
      setStep("otp");
      addToast("OTP sent to your email", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to send OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await verifyOtp(email, otp);
      if (res.is_new) {
        setStep("register");
      } else if (res.token && res.user) {
        setAuth(res.token, res.user);
        router.replace("/");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await register({
        email,
        otp,
        name,
        hostel_block: hostel,
        room_number: room || undefined,
        upi_vpa: upi || undefined,
      });
      setAuth(res.token, res.user);
      addToast("Welcome to CampusConnect!", "success");
      router.replace("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-600">CampusConnect</h1>
          <p className="text-gray-500 mt-1">NIT Goa P2P Food Delivery</p>
        </div>

        {/* Step: Email */}
        {step === "email" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@nitgoa.ac.in"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading || !email.trim()}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : "Send OTP"}
            </button>
          </div>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Enter the 4-digit OTP sent to <strong>{email}</strong>
            </p>
            {devOtp && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800 text-center">
                Dev mode OTP: <strong>{devOtp}</strong>
              </div>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="1234"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 4}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : "Verify OTP"}
            </button>
            <button
              onClick={() => { setStep("email"); setOtp(""); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* Step: Register */}
        {step === "register" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-2">
              First time? Set up your profile.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hostel Block
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["talpona", "terekhol"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setHostel(h)}
                    className={`py-3 rounded-xl border-2 font-medium capitalize transition ${
                      hostel === h
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Room Number (optional)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
            <input
              type="text"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="UPI ID (optional, for pilot payments)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleRegister}
              disabled={loading || !name.trim()}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : "Create Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
