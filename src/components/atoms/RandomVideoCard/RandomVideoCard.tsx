import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Play, ExternalLink, Youtube } from "lucide-react"

interface RandomVideoCardProps {
    videoTitle: string
    videoUrl: string
    viewCount: string
    publishedDate: string
}

const RandomVideoCard = ({ videoTitle, videoUrl, viewCount, publishedDate }: RandomVideoCardProps) => {
    // Extract video ID from YouTube URL
    const getVideoId = (url: string) => {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    };

    const videoId = getVideoId(videoUrl);
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?si=lURCJcSOGJ879eGV` : '';

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-center">FORWARDONTICS VIDEOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
                {/* YouTube Video Player */}
                <div className="relative w-full h-48 bg-gray-200 rounded-lg overflow-hidden">
                    {videoId ? (
                        <iframe
                            width="560"
                            height="315"
                            src={embedUrl}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            className="w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                            <div className="text-white text-center">
                                <div className="text-2xl mb-2">📹</div>
                                <div className="text-xs">Video not available</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Video Info */}
                <div className="space-y-2">
                    <h3 className="font-medium text-sm line-clamp-2 text-gray-900">
                        {videoTitle}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{viewCount} views</span>
                        <span>{publishedDate}</span>
                    </div>
                </div>

                {/* Watch Button */}
                <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    <Play className="w-4 h-4" />
                    <span>Watch on YouTube</span>
                    <ExternalLink className="w-4 h-4" />
                </a>

                {/* Channel Link */}
                <a
                    href="https://www.youtube.com/@Forwardontics/videos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors text-xs"
                >
                    <Youtube className="w-4 h-4" />
                    <span>View All Forwardontics Videos</span>
                </a>
            </CardContent>
        </Card>
    )
}

export default RandomVideoCard 