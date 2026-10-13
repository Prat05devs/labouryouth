import {useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Ionicons} from '@expo/vector-icons';
import {Field,colors,radius,space,styles,type} from './ui';

// Date or time choice backed by the native picker. value is 'YYYY-MM-DD' or 'HH:MM' in device time.
export function PickerField({label,mode,value,onChange,minimumDate}:{label:string;mode:'date'|'time';value:string;onChange:(v:string)=>void;minimumDate?:Date}){
 const [open,setOpen]=useState(false);
 if(Platform.OS==='web')return <Field label={label} value={value} onChangeText={onChange} placeholder={mode==='date'?'YYYY-MM-DD':'HH:MM'}/>;
 const now=new Date();const d=mode==='date'?new Date(value+'T00:00:00'):new Date(now.getFullYear(),now.getMonth(),now.getDate(),...value.split(':').map(Number) as [number,number]);
 const date=Number.isFinite(d.getTime())?d:now;
 const shown=mode==='date'?date.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}):date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 const pick=(next?:Date)=>{setOpen(false);if(!next)return;onChange(mode==='date'?next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-'+String(next.getDate()).padStart(2,'0'):String(next.getHours()).padStart(2,'0')+':'+String(next.getMinutes()).padStart(2,'0'));};
 return <View style={{gap:6}}>
  <Text style={styles.label}>{label}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={label+', '+shown} onPress={()=>setOpen(!open)} style={[styles.input,{justifyContent:'space-between'},open&&{borderColor:colors.trust,borderWidth:1.5}]}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name={mode==='date'?'calendar-outline':'time-outline'} size={19} color={colors.quiet}/><Text style={type.body}>{shown}</Text></View>
   <Ionicons name={open?'chevron-up':'chevron-down'} size={18} color={colors.quiet}/>
  </Pressable>
  {open?<View style={Platform.OS==='ios'?{backgroundColor:colors.white,borderRadius:radius.md,paddingVertical:space.sm}:undefined}><DateTimePicker value={date} mode={mode} minimumDate={minimumDate} display={Platform.OS==='ios'?(mode==='date'?'inline':'spinner'):'default'} onChange={(e,next)=>{if(Platform.OS==='ios'){if(next)pick(next);if(mode==='time')setOpen(true);}else pick(e.type==='set'?next:undefined);}} accentColor={colors.trust}/></View>:null}
 </View>;
}
