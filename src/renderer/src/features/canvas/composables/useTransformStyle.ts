import { computed, MaybeRefOrGetter, Ref, toValue } from 'vue'
import { Transform } from '../canvas_utils'

export function useTransformStyle(transformSource: MaybeRefOrGetter<Transform>) {
    return computed(() => {
        const transform = toValue(transformSource)
        if (!transform) return { display: 'none' }

        const { x, y } = transform.position
        const scale = transform.scale

        const { width, height, rotation, zIndex } = transform

        return {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            transform: `translate3d(${x}px, ${y}px,0) rotate(${rotation}rad)`,
            transformOrigin: 'top left',
            'z-index': zIndex
        }
    })
}
