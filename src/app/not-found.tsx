"use client";

import { Button } from '@/components/ui';
import { Puzzle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
    const router = useRouter();
    return (
        <div className="min-h-screen flex items-center justify-center bg-quaternary">
            <div className="max-w-md w-full  p-8">
                <div className="text-center">
                    <div className="mx-auto h-44 w-44 text-gray-400 mb-10">
                        <Puzzle className="w-44 h-44" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Page Not Found
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        The page you&apos;re looking for doesn&apos;t exist.
                    </p>
                </div>
                <div className="mt-8 space-y-4">
                    <Button
                        onClick={() => router.push('/login')}
                        className="w-full bg-main hover:bg-main/80"
                    >
                        Go to Login
                    </Button>
                    <Button
                        onClick={() => window.history.back()}
                        variant="outline"
                        className="w-full"
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
    );
} 