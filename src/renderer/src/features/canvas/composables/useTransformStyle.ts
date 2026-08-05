import { computed, MaybeRefOrGetter, toValue } from 'vue'
import { Transform } from '../ts/scene/CanvasUtils'

export function useTransformStyle(transformSource: MaybeRefOrGetter<Transform>) {
    return computed(() => {
        const transform = toValue(transformSource)
        if (!transform) return { display: 'none' }

        const { x, y } = transform.position
        // const { x: px, y: py } = transform.parentTransform?.position ?? { x: 0, y: 0 }
        const scale = transform.scale

        const { width, height, rotation, zIndex } = transform

        return {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate3d(${x}px, ${y}px,0) rotate(${rotation}rad) scale(${scale})`,
            transformOrigin: 'top left',
            zIndex: zIndex
        }
    })
}

export function useTransformStyleUnzoomed(
    transformSource: MaybeRefOrGetter<Transform>,
    zoomSource: MaybeRefOrGetter<number>
) {
    return computed(() => {
        const transform = toValue(transformSource)
        const zoom = toValue(zoomSource)
        if (!transform) return { display: 'none' }

        const { x, y } = transform.position

        const { width, height, rotation, zIndex } = transform

        return {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: `${width * zoom}px`,
            height: `${height * zoom}px`,
            transform: `translate3d(${x}px, ${y}px,0) rotate(${rotation}rad) scale(${1 / zoom})`,
            transformOrigin: 'top left',
            zIndex: zIndex
        }
    })
}
