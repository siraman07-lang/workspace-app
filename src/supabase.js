import { createClient } from '@supabase/supabase-js'

// 아래 두 줄의 따옴표('') 안에 아까 발급받은 주소와 키를 넣으세요!
const supabaseUrl = 'https://oakgtkebvmrfupnkbbsb.supabase.co'
const supabaseKey = 'sb_publishable_4BTCbII60yAJ25A65iE2Dw_h_DbIZkj'

export const supabase = createClient(supabaseUrl, supabaseKey)
