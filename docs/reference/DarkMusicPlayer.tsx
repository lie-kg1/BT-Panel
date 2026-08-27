// Dark music theme.

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useInView } from "framer-motion"

type Img = { src: string; srcSet?: string; alt?: string }

type FontStyle = any

type Track = {
    title: string
    artist: string
    audioFile: string
    cover?: Img
}

type DarkMusicPlayerProps = {
    tracks: Track[]

    compact: boolean
    showShuffle: boolean
    showPrevNext: boolean
    showLoopButton: boolean

    showPlaylist: boolean
    showCover: boolean
    autoplay: boolean
    loop: boolean

    // Glassmorphism
    glass: boolean
    glassBlur: number
    glassOpacity: number

    // Background fill
    backgroundFill: "color" | "image" | "gradient"
    backgroundImage?: Img
    backgroundGradient: string

    // Color schemes
    colorScheme: "dark" | "midnight" | "light" | "custom"

    background: string
    surface: string
    textColor: string
    subTextColor: string
    accent: string
    borderColor: string

    titleFont: FontStyle
    metaFont: FontStyle

    radius: number
    padding: number
    showVolume: boolean

    style?: React.CSSProperties
}

/**
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 124
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
function DarkMusicPlayer(props: DarkMusicPlayerProps) {
    const {
        tracks = [
            {
                title: "Night Drive",
                artist: "Darkwave FM",
                audioFile:
                    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
                cover: {
                    src: "https://framerusercontent.com/images/f9RiWoNpmlCMqVRIHz8l8wYfeI.jpg",
                    alt: "Album cover",
                },
            },
            {
                title: "Neon Streets",
                artist: "Darkwave FM",
                audioFile:
                    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
                cover: {
                    src: "https://framerusercontent.com/images/aNsAT3jCvt4zglbWCUoFe33Q.jpg",
                    alt: "Album cover",
                },
            },
        ],
        compact = true,
        showShuffle = true,
        showPrevNext = true,
        showLoopButton = true,
        showPlaylist,
        showCover,
        autoplay,
        loop,

        glass = true,
        glassBlur = 18,
        glassOpacity = 0.72,

        backgroundFill = "color",
        backgroundImage = {
            src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
            alt: "Background image",
        },
        backgroundGradient = "linear-gradient(135deg, rgba(136,85,255,0.35), rgba(0,153,255,0.25))",

        colorScheme = "dark",

        background,
        surface,
        textColor,
        subTextColor,
        accent,
        borderColor,

        titleFont,
        metaFont,

        radius,
        padding,
        showVolume,

        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const audioRef = React.useRef<HTMLAudioElement | null>(null)
    const trackButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([])
    const resumeAfterSourceChangeRef = React.useRef(false)

    const inView = useInView(rootRef, {
        margin: "120px 0px 120px 0px",
        amount: 0.2,
    })

    const [isPlaying, setIsPlaying] = React.useState(false)
    const [duration, setDuration] = React.useState(0)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [volume, setVolume] = React.useState(1)
    const [isSeeking, setIsSeeking] = React.useState(false)
    const [showList, setShowList] = React.useState(showPlaylist)
    const [trackIndex, setTrackIndex] = React.useState(0)
    const [shuffle, setShuffle] = React.useState(false)

    const activeTrack = React.useMemo<Track | null>(() => {
        if (!tracks || tracks.length === 0) return null
        const idx = Math.max(0, Math.min(tracks.length - 1, trackIndex))
        return tracks[idx]
    }, [tracks, trackIndex])

    const effectiveTitle = activeTrack?.title ?? "Untitled"
    const effectiveArtist = activeTrack?.artist ?? "Unknown artist"
    const effectiveAudioFile =
        activeTrack?.audioFile ??
        "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
    const effectiveCover: Img =
        activeTrack?.cover ??
        ({
            src: "https://framerusercontent.com/images/f9RiWoNpmlCMqVRIHz8l8wYfeI.jpg",
            alt: "Album cover",
        } as Img)

    const safePct = React.useMemo(() => {
        if (!duration || !isFinite(duration) || duration <= 0) return 0
        const pct = (currentTime / duration) * 100
        return Math.max(0, Math.min(100, pct))
    }, [currentTime, duration])

    const formatTime = React.useCallback((t: number) => {
        if (!isFinite(t) || t < 0) return "0:00"
        const m = Math.floor(t / 60)
        const s = Math.floor(t % 60)
        return `${m}:${String(s).padStart(2, "0")}`
    }, [])

    const ensureAudio = React.useCallback(() => {
        if (typeof window === "undefined") return null
        return audioRef.current
    }, [])

    const setAudioTime = React.useCallback(
        (nextTime: number) => {
            const a = ensureAudio()
            if (!a) return
            const d = a.duration
            if (!isFinite(d) || d <= 0) return
            const clamped = Math.max(0, Math.min(d, nextTime))
            try {
                a.currentTime = clamped
            } catch {
                // ignore
            }
            React.startTransition(() => setCurrentTime(clamped))
        },
        [ensureAudio]
    )

    const togglePlay = React.useCallback(async () => {
        if (isStatic) return
        const a = ensureAudio()
        if (!a) return

        if (a.paused) {
            try {
                a.volume = Math.max(0, Math.min(1, volume))
                await a.play()
                React.startTransition(() => setIsPlaying(true))
            } catch {
                React.startTransition(() => setIsPlaying(false))
            }
        } else {
            a.pause()
            React.startTransition(() => setIsPlaying(false))
        }
    }, [ensureAudio, isStatic, volume])

    const pause = React.useCallback(() => {
        const a = ensureAudio()
        if (!a) return
        a.pause()
        React.startTransition(() => setIsPlaying(false))
    }, [ensureAudio])

    const selectTrack = React.useCallback(
        (i: number) => {
            if (isStatic) return
            const nextIndex = Math.max(
                0,
                Math.min((tracks?.length ?? 1) - 1, i)
            )
            resumeAfterSourceChangeRef.current = isPlaying
            React.startTransition(() => setTrackIndex(nextIndex))
        },
        [isPlaying, isStatic, tracks?.length]
    )

    const selectRelative = React.useCallback(
        (dir: -1 | 1) => {
            if (isStatic) return
            const count = tracks?.length ?? 0
            if (count <= 0) return
            if (shuffle) {
                const next = Math.floor(Math.random() * count)
                selectTrack(next)
                return
            }
            const next = (trackIndex + dir + count) % count
            selectTrack(next)
        },
        [isStatic, shuffle, selectTrack, trackIndex, tracks?.length]
    )

    React.useEffect(() => {
        if (isStatic) return
        if (typeof window === "undefined") return

        const a = audioRef.current
        if (!a) return

        const onLoadedMetadata = () => {
            const d = a.duration
            React.startTransition(() => setDuration(isFinite(d) ? d : 0))
            React.startTransition(() =>
                setCurrentTime(isFinite(a.currentTime) ? a.currentTime : 0)
            )
        }

        const onTimeUpdate = () => {
            if (isSeeking) return
            const t = a.currentTime
            React.startTransition(() => setCurrentTime(isFinite(t) ? t : 0))
        }

        const onPlay = () => React.startTransition(() => setIsPlaying(true))
        const onPause = () => React.startTransition(() => setIsPlaying(false))
        const onDurationChange = () => {
            const d = a.duration
            React.startTransition(() => setDuration(isFinite(d) ? d : 0))
        }
        const onEnded = () => React.startTransition(() => setIsPlaying(false))

        a.addEventListener("loadedmetadata", onLoadedMetadata)
        a.addEventListener("timeupdate", onTimeUpdate)
        a.addEventListener("play", onPlay)
        a.addEventListener("pause", onPause)
        a.addEventListener("durationchange", onDurationChange)
        a.addEventListener("ended", onEnded)

        return () => {
            a.removeEventListener("loadedmetadata", onLoadedMetadata)
            a.removeEventListener("timeupdate", onTimeUpdate)
            a.removeEventListener("play", onPlay)
            a.removeEventListener("pause", onPause)
            a.removeEventListener("durationchange", onDurationChange)
            a.removeEventListener("ended", onEnded)
        }
    }, [isSeeking, isStatic])

    React.useEffect(() => {
        if (isStatic) return
        if (!autoplay) return
        const a = ensureAudio()
        if (!a) return
        if (!inView) return
        if (!a.paused) return
        ;(async () => {
            try {
                a.volume = Math.max(0, Math.min(1, volume))
                await a.play()
                React.startTransition(() => setIsPlaying(true))
            } catch {
                React.startTransition(() => setIsPlaying(false))
            }
        })()
    }, [autoplay, ensureAudio, inView, isStatic, volume])

    React.useEffect(() => {
        if (isStatic) return
        if (!inView) pause()
    }, [inView, isStatic, pause])

    React.useEffect(() => {
        if (isStatic) return
        const a = ensureAudio()
        if (!a) return

        // If source changes, reset state
        pause()
        React.startTransition(() => setCurrentTime(0))
        React.startTransition(() => setDuration(0))

        const shouldResume = resumeAfterSourceChangeRef.current
        resumeAfterSourceChangeRef.current = false
        if (!shouldResume) return

        const onCanPlay = async () => {
            if (!inView) return
            try {
                a.volume = Math.max(0, Math.min(1, volume))
                await a.play()
                React.startTransition(() => setIsPlaying(true))
            } catch {
                React.startTransition(() => setIsPlaying(false))
            }
        }

        a.addEventListener("canplay", onCanPlay, { once: true })
        return () => a.removeEventListener("canplay", onCanPlay)
    }, [effectiveAudioFile, ensureAudio, inView, isStatic, pause, volume])

    React.useEffect(() => {
        if (isStatic) return
        const a = ensureAudio()
        if (!a) return
        try {
            a.loop = !!loop
        } catch {
            // ignore
        }
    }, [ensureAudio, isStatic, loop])

    React.useEffect(() => {
        if (isStatic) return
        const a = ensureAudio()
        if (!a) return
        try {
            a.volume = Math.max(0, Math.min(1, volume))
        } catch {
            // ignore
        }
    }, [ensureAudio, isStatic, volume])

    React.useEffect(() => {
        if (isStatic) return
        if (!showPlaylist || !showList) return
        if (typeof window === "undefined") return
        requestAnimationFrame(() => {
            const el = trackButtonRefs.current[trackIndex]
            el?.focus?.()
        })
    }, [isStatic, showList, showPlaylist, trackIndex])

    const onProgressPointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (isStatic) return
            const el = e.currentTarget
            el.setPointerCapture?.(e.pointerId)
            React.startTransition(() => setIsSeeking(true))

            const rect = el.getBoundingClientRect()
            const x = e.clientX - rect.left
            const pct = rect.width > 0 ? x / rect.width : 0
            const a = ensureAudio()
            if (!a || !isFinite(a.duration) || a.duration <= 0) return
            setAudioTime(pct * a.duration)
        },
        [ensureAudio, isStatic, setAudioTime]
    )

    const onProgressPointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (isStatic) return
            if (!isSeeking) return
            const el = e.currentTarget
            const rect = el.getBoundingClientRect()
            const x = e.clientX - rect.left
            const pct = rect.width > 0 ? x / rect.width : 0
            const a = ensureAudio()
            if (!a || !isFinite(a.duration) || a.duration <= 0) return
            setAudioTime(pct * a.duration)
        },
        [ensureAudio, isSeeking, isStatic, setAudioTime]
    )

    const onProgressPointerUp = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (isStatic) return
            React.startTransition(() => setIsSeeking(false))
            e.currentTarget.releasePointerCapture?.(e.pointerId)
        },
        [isStatic]
    )

    const isFixedWidth = !!(style && style.width === "100%")
    const isFixedHeight = !!(style && style.height === "100%")

    const glassRootStyle = React.useMemo<React.CSSProperties>(() => {
        if (!glass) return {}
        return {
            backdropFilter: `blur(${Math.max(0, glassBlur)}px)`,
            WebkitBackdropFilter: `blur(${Math.max(0, glassBlur)}px)`,
            boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
        }
    }, [glass, glassBlur, glassOpacity])

    const palette = React.useMemo(() => {
        if (colorScheme === "midnight") {
            return {
                background: "#06060A",
                surface: "#101023",
                textColor: "#FFFFFF",
                subTextColor: "#B7B7C6",
                accent: "#8855FF",
                borderColor: "#24243A",
            }
        }
        if (colorScheme === "light") {
            return {
                background: "#FFFFFF",
                surface: "#F5F5F5",
                textColor: "#0B0B0E",
                subTextColor: "#555555",
                accent: "#0066FF",
                borderColor: "#EEEEEE",
            }
        }
        if (colorScheme === "dark") {
            return {
                background: "#0B0B0E",
                surface: "#12121A",
                textColor: "#FFFFFF",
                subTextColor: "#CCCCCC",
                accent: "#8855FF",
                borderColor: "#1D1D27",
            }
        }

        // custom
        return {
            background,
            surface,
            textColor,
            subTextColor,
            accent,
            borderColor,
        }
    }, [
        accent,
        background,
        borderColor,
        colorScheme,
        subTextColor,
        surface,
        textColor,
    ])

    const bg = palette.background
    const sf = palette.surface
    const tx = palette.textColor
    const sub = palette.subTextColor
    const ac = palette.accent
    const bd = palette.borderColor

    const rootBackgroundStyle = React.useMemo<React.CSSProperties>(() => {
        if (backgroundFill === "gradient") {
            return {
                backgroundImage: backgroundGradient,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }
        }

        if (backgroundFill === "image") {
            const src = backgroundImage?.src
            return {
                backgroundImage: src ? `url(${src})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }
        }

        return { background: bg }
    }, [backgroundFill, backgroundGradient, backgroundImage?.src, bg])

    const glassSurfaceStyle = React.useMemo<React.CSSProperties>(() => {
        if (!glass) return {}
        return {
            background: `rgba(18, 18, 26, ${Math.max(0, Math.min(1, glassOpacity))})`,
            backdropFilter: `blur(${Math.max(0, glassBlur)}px)`,
            WebkitBackdropFilter: `blur(${Math.max(0, glassBlur)}px)`,
        }
    }, [glass, glassBlur, glassOpacity])

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                ...rootBackgroundStyle,
                borderRadius: radius,
                padding,
                boxSizing: "border-box",
                overflow: "hidden",
                border: `1px solid ${bd}`,
                ...(isFixedWidth ? null : { minWidth: 280 }),
                ...(isFixedHeight ? null : { minHeight: 96 }),
                ...(glass
                    ? {
                          backgroundColor: `rgba(11, 11, 14, ${Math.max(0, Math.min(1, glassOpacity))})`,
                      }
                    : null),
                ...style,
            }}
            role="group"
            aria-label="Music player"
        >
            {glass && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: radius,
                        pointerEvents: "none",
                        background: `rgba(11, 11, 14, ${Math.max(0, Math.min(1, glassOpacity))})`,
                        ...glassRootStyle,
                    }}
                />
            )}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                {!compact && showCover && (
                    <div
                        style={{
                            position: "relative",
                            width: 64,
                            height: 64,
                            borderRadius: Math.max(8, radius - 8),
                            overflow: "hidden",
                            flex: "0 0 auto",
                            background: sf,
                            border: `1px solid ${bd}`,
                        }}
                        aria-hidden="true"
                    >
                        <img
                            src={effectiveCover?.src}
                            srcSet={effectiveCover?.srcSet}
                            alt={effectiveCover?.alt ?? "Album cover"}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                            }}
                            draggable={false}
                        />
                    </div>
                )}

                <div
                    style={{
                        position: "relative",
                        flex: "1 1 auto",
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: compact ? 10 : 8,
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                        }}
                    >
                        {compact && showShuffle && (
                            <button
                                type="button"
                                disabled={isStatic}
                                aria-label={
                                    shuffle ? "Shuffle on" : "Shuffle off"
                                }
                                onClick={() => {
                                    if (isStatic) return
                                    React.startTransition(() =>
                                        setShuffle((s) => !s)
                                    )
                                }}
                                style={{
                                    position: "relative",
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: `1px solid ${bd}`,
                                    background: sf,
                                    ...glassSurfaceStyle,
                                    color: tx,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: isStatic ? "default" : "pointer",
                                    padding: 0,
                                    opacity: shuffle ? 1 : 0.7,
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M16 3h5v5l-8 7 8 7z"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M3 11V9a4 4 0 0 1 4-4h14"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M7 23l-4-4 4-4"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M21 13v2a4 4 0 0 1-4 4H3"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        )}

                        {compact && showPrevNext && (
                            <button
                                type="button"
                                onClick={() => selectRelative(-1)}
                                disabled={isStatic}
                                aria-label="Previous track"
                                style={{
                                    position: "relative",
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: `1px solid ${bd}`,
                                    background: sf,
                                    ...glassSurfaceStyle,
                                    color: tx,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: isStatic ? "default" : "pointer",
                                    padding: 0,
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path d="M11 19V5l-8 7 8 7z" fill={ac} />
                                    <rect
                                        x="14.5"
                                        y="6"
                                        width="2"
                                        height="12"
                                        rx="1"
                                        fill={ac}
                                    />
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={togglePlay}
                            disabled={isStatic}
                            aria-label={isPlaying ? "Pause" : "Play"}
                            style={{
                                position: "relative",
                                width: compact ? 44 : 40,
                                height: compact ? 44 : 40,
                                borderRadius: compact ? 999 : 12,
                                border: `1px solid ${bd}`,
                                background: sf,
                                ...glassSurfaceStyle,
                                color: tx,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: isStatic ? "default" : "pointer",
                                flex: "0 0 auto",
                                padding: 0,
                                outline: "none",
                            }}
                        >
                            {isPlaying ? (
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <rect
                                        x="6.5"
                                        y="5.5"
                                        width="4"
                                        height="13"
                                        rx="1"
                                        fill={ac}
                                    />
                                    <rect
                                        x="13.5"
                                        y="5.5"
                                        width="4"
                                        height="13"
                                        rx="1"
                                        fill={ac}
                                    />
                                </svg>
                            ) : (
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M9 7.8v8.4c0 .8.9 1.3 1.6.9l7-4.2c.7-.4.7-1.4 0-1.8l-7-4.2c-.7-.4-1.6.1-1.6.9z"
                                        fill={ac}
                                    />
                                </svg>
                            )}
                        </button>

                        {compact && showPrevNext && (
                            <button
                                type="button"
                                onClick={() => selectRelative(1)}
                                disabled={isStatic}
                                aria-label="Next track"
                                style={{
                                    position: "relative",
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: `1px solid ${bd}`,
                                    background: sf,
                                    ...glassSurfaceStyle,
                                    color: tx,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: isStatic ? "default" : "pointer",
                                    padding: 0,
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path d="M13 5v14l8-7-8-7z" fill={ac} />
                                    <rect
                                        x="7.5"
                                        y="6"
                                        width="2"
                                        height="12"
                                        rx="1"
                                        fill={ac}
                                    />
                                </svg>
                            </button>
                        )}

                        {compact && showLoopButton && (
                            <button
                                type="button"
                                disabled={isStatic}
                                aria-label={loop ? "Loop on" : "Loop off"}
                                style={{
                                    position: "relative",
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: `1px solid ${bd}`,
                                    background: sf,
                                    ...glassSurfaceStyle,
                                    color: tx,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "default",
                                    padding: 0,
                                    opacity: loop ? 1 : 0.7,
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M17 1l4 4-4 4"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M3 11V9a4 4 0 0 1 4-4h14"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M7 23l-4-4 4-4"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M21 13v2a4 4 0 0 1-4 4H3"
                                        stroke={ac}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        )}

                        {!compact && (
                            <div
                                style={{
                                    position: "relative",
                                    flex: "1 1 auto",
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        ...titleFont,
                                        color: tx,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: isFixedWidth
                                            ? undefined
                                            : "max-content",
                                    }}
                                >
                                    {effectiveTitle}
                                </div>
                                <div
                                    style={{
                                        ...metaFont,
                                        color: sub,
                                        marginTop: 2,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: isFixedWidth
                                            ? undefined
                                            : "max-content",
                                    }}
                                >
                                    {effectiveArtist}
                                </div>
                            </div>
                        )}

                        {!compact && showPlaylist && (
                            <button
                                type="button"
                                disabled={isStatic}
                                aria-label={
                                    showList ? "Hide playlist" : "Show playlist"
                                }
                                onClick={() => {
                                    if (isStatic) return
                                    React.startTransition(() =>
                                        setShowList((s) => !s)
                                    )
                                }}
                                onKeyDown={(e) => {
                                    if (isStatic) return
                                    if (!showList) return
                                    if (
                                        e.key === "ArrowDown" ||
                                        e.key === "Enter" ||
                                        e.key === " "
                                    ) {
                                        e.preventDefault()
                                        requestAnimationFrame(() => {
                                            const el =
                                                trackButtonRefs.current[
                                                    trackIndex
                                                ] || trackButtonRefs.current[0]
                                            el?.focus?.()
                                        })
                                    }
                                }}
                                style={{
                                    position: "relative",
                                    borderRadius: 999,
                                    padding: "8px 10px",
                                    border: `1px solid ${bd}`,
                                    background: sf,
                                    ...glassSurfaceStyle,
                                    color: tx,
                                    cursor: isStatic ? "default" : "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: "0 0 auto",
                                    userSelect: "none",
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        background: ac,
                                    }}
                                />
                                <span
                                    style={{
                                        ...metaFont,
                                        color: sub,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {tracks?.length ?? 0} tracks
                                </span>
                            </button>
                        )}
                    </div>

                    {showPlaylist && showList && !compact && (
                        <div
                            role="list"
                            aria-label="Playlist"
                            tabIndex={-1}
                            style={{
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                padding: 10,
                                borderRadius: 12,
                                border: `1px solid ${bd}`,
                                background: sf,
                                ...glassSurfaceStyle,
                            }}
                        >
                            {(tracks ?? []).map((t, i) => {
                                const active = i === trackIndex
                                return (
                                    <button
                                        key={`${t.title}-${i}`}
                                        ref={(el) => {
                                            trackButtonRefs.current[i] = el
                                        }}
                                        type="button"
                                        role="listitem"
                                        disabled={isStatic}
                                        onClick={() => selectTrack(i)}
                                        onKeyDown={(e) => {
                                            if (isStatic) return
                                            const count = tracks?.length ?? 0
                                            if (count <= 0) return
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                e.preventDefault()
                                                selectTrack(i)
                                                return
                                            }
                                            if (e.key === "ArrowDown") {
                                                e.preventDefault()
                                                const next = (i + 1) % count
                                                trackButtonRefs.current[
                                                    next
                                                ]?.focus?.()
                                                return
                                            }
                                            if (e.key === "ArrowUp") {
                                                e.preventDefault()
                                                const prev =
                                                    (i - 1 + count) % count
                                                trackButtonRefs.current[
                                                    prev
                                                ]?.focus?.()
                                                return
                                            }
                                            if (e.key === "Home") {
                                                e.preventDefault()
                                                trackButtonRefs.current[0]?.focus?.()
                                                return
                                            }
                                            if (e.key === "End") {
                                                e.preventDefault()
                                                trackButtonRefs.current[
                                                    count - 1
                                                ]?.focus?.()
                                            }
                                        }}
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 10,
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            border: `1px solid ${active ? ac : bd}`,
                                            background: active
                                                ? "rgba(136,85,255,0.12)"
                                                : "rgba(255,255,255,0.02)",
                                            color: tx,
                                            cursor: isStatic
                                                ? "default"
                                                : "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        <span
                                            style={{
                                                ...metaFont,
                                                color: tx,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                flex: "1 1 auto",
                                                minWidth: 0,
                                            }}
                                        >
                                            {t.title}
                                        </span>
                                        <span
                                            style={{
                                                ...metaFont,
                                                color: sub,
                                                whiteSpace: "nowrap",
                                                flex: "0 0 auto",
                                            }}
                                        >
                                            {t.artist}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <div
                            onPointerDown={onProgressPointerDown}
                            onPointerMove={onProgressPointerMove}
                            onPointerUp={onProgressPointerUp}
                            role="slider"
                            aria-label="Seek"
                            aria-valuemin={0}
                            aria-valuemax={Math.max(0, Math.floor(duration))}
                            aria-valuenow={Math.max(0, Math.floor(currentTime))}
                            tabIndex={isStatic ? -1 : 0}
                            onKeyDown={(e) => {
                                if (isStatic) return
                                const a = audioRef.current
                                if (
                                    !a ||
                                    !isFinite(a.duration) ||
                                    a.duration <= 0
                                )
                                    return
                                const step = Math.max(1, a.duration / 30)
                                if (e.key === "ArrowLeft")
                                    setAudioTime((a.currentTime || 0) - step)
                                if (e.key === "ArrowRight")
                                    setAudioTime((a.currentTime || 0) + step)
                            }}
                            style={{
                                position: "relative",
                                flex: "1 1 auto",
                                height: compact ? 6 : 10,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.08)",
                                overflow: "hidden",
                                border: `1px solid rgba(255,255,255,0.10)`,
                                cursor: isStatic ? "default" : "pointer",
                                touchAction: "none",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    height: "100%",
                                    width: `${safePct}%`,
                                    background: ac,
                                }}
                            />
                            {!compact && (
                                <div
                                    style={{
                                        position: "absolute",
                                        left: `calc(${safePct}% - 6px)`,
                                        top: "50%",
                                        width: 12,
                                        height: 12,
                                        borderRadius: 999,
                                        transform: "translateY(-50%)",
                                        background: "#FFFFFF",
                                        opacity: isStatic ? 0.6 : 0.9,
                                        boxShadow:
                                            "0 6px 16px rgba(0,0,0,0.35)",
                                        border: `1px solid rgba(0,0,0,0.25)`,
                                        pointerEvents: "none",
                                    }}
                                    aria-hidden="true"
                                />
                            )}
                        </div>

                        {!compact && (
                            <div
                                style={{
                                    ...metaFont,
                                    color: sub,
                                    fontSize: metaFont?.fontSize ?? "12px",
                                    minWidth: 78,
                                    textAlign: "right",
                                    userSelect: "none",
                                }}
                                aria-label="Time"
                            >
                                {formatTime(currentTime)} /{" "}
                                {formatTime(duration)}
                            </div>
                        )}

                        {showVolume && !compact && (
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                aria-label="Volume"
                                disabled={isStatic}
                                onChange={(e) => {
                                    const v = Number(e.currentTarget.value)
                                    React.startTransition(() =>
                                        setVolume(
                                            isFinite(v)
                                                ? Math.max(0, Math.min(1, v))
                                                : 1
                                        )
                                    )
                                }}
                                style={{
                                    position: "relative",
                                    width: 88,
                                    accentColor: ac as any,
                                    cursor: isStatic ? "default" : "pointer",
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {typeof window !== "undefined" && (
                <audio
                    ref={audioRef}
                    src={effectiveAudioFile}
                    preload="metadata"
                    style={{ display: "none" }}
                />
            )}
        </div>
    )
}

// Ensure Framer can reliably infer the component name.
DarkMusicPlayer.displayName = "DarkMusicPlayer"

export default DarkMusicPlayer

addPropertyControls(DarkMusicPlayer, {
    tracks: {
        type: ControlType.Array,
        title: "Tracks",
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Track",
                },
                artist: {
                    type: ControlType.String,
                    title: "Artist",
                    defaultValue: "Artist",
                },
                audioFile: {
                    type: ControlType.File,
                    title: "Audio",
                    allowedFileTypes: ["mp3", "wav", "ogg"],
                },
                cover: { type: ControlType.ResponsiveImage, title: "Cover" },
            },
        },
        defaultValue: [{ title: "Night Drive", artist: "Darkwave FM" }],
    },
    compact: {
        type: ControlType.Boolean,
        title: "Compact",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    backgroundFill: {
        type: ControlType.Enum,
        title: "BG Fill",
        options: ["color", "image", "gradient"],
        optionTitles: ["Color", "Image", "Gradient"],
        defaultValue: "color",
        displaySegmentedControl: true,
    },
    backgroundImage: {
        type: ControlType.ResponsiveImage,
        title: "BG Image",
        hidden: ({ backgroundFill }) => backgroundFill !== "image",
    },
    backgroundGradient: {
        type: ControlType.String,
        title: "BG Gradient",
        defaultValue:
            "linear-gradient(135deg, rgba(136,85,255,0.35), rgba(0,153,255,0.25))",
        hidden: ({ backgroundFill }) => backgroundFill !== "gradient",
    },

    glass: {
        type: ControlType.Boolean,
        title: "Glass",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    glassBlur: {
        type: ControlType.Number,
        title: "Blur",
        defaultValue: 18,
        min: 0,
        max: 40,
        step: 1,
        hidden: ({ glass }) => !glass,
    },
    glassOpacity: {
        type: ControlType.Number,
        title: "Opacity",
        defaultValue: 0.72,
        min: 0,
        max: 1,
        step: 0.01,
        hidden: ({ glass }) => !glass,
    },

    showShuffle: {
        type: ControlType.Boolean,
        title: "Shuffle",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        hidden: ({ compact }) => !compact,
    },
    showPrevNext: {
        type: ControlType.Boolean,
        title: "Prev/Next",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        hidden: ({ compact }) => !compact,
    },
    showLoopButton: {
        type: ControlType.Boolean,
        title: "Loop Icon",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        hidden: ({ compact }) => !compact,
    },
    showPlaylist: {
        type: ControlType.Boolean,
        title: "Playlist",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ compact }) => compact,
    },
    showCover: {
        type: ControlType.Boolean,
        title: "Cover",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        hidden: ({ compact }) => compact,
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    colorScheme: {
        type: ControlType.Enum,
        title: "Scheme",
        options: ["dark", "midnight", "light", "custom"],
        optionTitles: ["Dark", "Midnight", "Light", "Custom"],
        defaultValue: "dark",
        displaySegmentedControl: true,
    },

    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0B0B0E",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },
    surface: {
        type: ControlType.Color,
        title: "Surface",
        defaultValue: "#12121A",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#FFFFFF",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },
    subTextColor: {
        type: ControlType.Color,
        title: "Sub Text",
        defaultValue: "#CCCCCC",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },
    accent: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#8855FF",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border",
        defaultValue: "#1D1D27",
        hidden: ({ colorScheme }) => colorScheme !== "custom",
    },

    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "15px",
            variant: "Semibold",
            letterSpacing: "-0.01em",
            lineHeight: "1.1em",
        },
        hidden: ({ compact }) => compact,
    },
    metaFont: {
        type: ControlType.Font,
        title: "Meta Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "12px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1.2em",
        },
        hidden: ({ compact }) => compact,
    },

    radius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 16,
        min: 0,
        max: 40,
        step: 1,
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 14,
        min: 0,
        max: 40,
        step: 1,
    },
    showVolume: {
        type: ControlType.Boolean,
        title: "Volume",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
        hidden: ({ compact }) => compact,
    },
})
