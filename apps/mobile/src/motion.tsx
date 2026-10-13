import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,StyleProp,ViewStyle} from 'react-native';

const MotionContext=createContext(true);
export const useReducedMotion=()=>useContext(MotionContext);

export function MotionProvider({children}:{children:React.ReactNode}){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let mounted=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReduced(value);}).catch(()=>{});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{mounted=false;listener.remove();};},[]);
 return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

// Short, native-driver entrances. Reduced motion always shows final content.
export function MotionView({children,style,delay=0}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;delay?:number}){
 const reduced=useReducedMotion();const progress=useRef(new Animated.Value(1)).current;
 useEffect(()=>{if(reduced){progress.setValue(1);return;}progress.setValue(0);const animation=Animated.timing(progress,{toValue:1,duration:420,delay,easing:Easing.out(Easing.cubic),useNativeDriver:true,isInteraction:false});animation.start();return()=>animation.stop();},[progress,reduced,delay]);
 return <Animated.View style={[style,{opacity:progress.interpolate({inputRange:[0,1],outputRange:[0.65,1]}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}]}>{children}</Animated.View>;
}

export function FloatView({children,style,delay=0,distance=8,duration=2800}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;delay?:number;distance?:number;duration?:number}){
 const reduced=useReducedMotion();const float=useRef(new Animated.Value(0)).current;
 useEffect(()=>{if(reduced){float.setValue(0);return;}const loop=Animated.loop(Animated.sequence([Animated.delay(delay),Animated.timing(float,{toValue:1,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),Animated.timing(float,{toValue:0,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false})]));loop.start();return()=>loop.stop();},[float,reduced,delay,duration]);
 return <Animated.View style={[style,{transform:[{translateY:float.interpolate({inputRange:[0,1],outputRange:[0,-distance]})}]}]}>{children}</Animated.View>;
}
