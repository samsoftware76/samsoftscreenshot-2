'use client';

import { useState, useRef, useCallback } from 'react';

interface WebcamCaptureProps {
    onCapture: (base64Image: string) => void;
    onError: (error: string) => void;
}

export default function WebcamCapture({ onCapture, onError }: WebcamCaptureProps) {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setIsCameraOpen(true);
        } catch (err) {
            // fallback to any camera available if environment fails
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
                setStream(fallbackStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = fallbackStream;
                }
                setIsCameraOpen(true);
            } catch (fallbackErr) {
                console.error('Camera error:', err);
                onError('Could not access camera. Please ensure permissions are granted.');
            }
        }
    };

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraOpen(false);
    }, [stream]);

    const takePhoto = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.85); // Compress slightly
            onCapture(base64Image);
            stopCamera();
        }
    };

    return (
        <div className="relative">
            {!isCameraOpen ? (
                <button
                    type="button"
                    onClick={startCamera}
                    className="p-3 text-gray-500 hover:text-black hover:bg-gray-200 rounded-xl transition-colors"
                    title="Open Webcam"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            ) : (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full flex flex-col">
                        <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                            <h3 className="font-bold">Webcam Viewer</h3>
                            <button onClick={stopCamera} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md text-sm font-semibold transition-colors">Close</button>
                        </div>
                        <div className="relative bg-black flex-1 aspect-video flex items-center justify-center">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="p-4 bg-gray-100 flex justify-center border-t border-gray-200">
                            <button
                                onClick={takePhoto}
                                className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all text-white flex items-center justify-center shadow-lg active:scale-95 border-4 border-blue-200"
                                title="Capture"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="5" strokeWidth={3} />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
