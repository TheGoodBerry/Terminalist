T.save={key:'terminalist.v1',
 save(){localStorage.setItem(this.key,JSON.stringify(T.game.exp()));T.game.toast('Saved')},
 load(){const s=localStorage.getItem(this.key);if(!s)return false;try{T.game.imp(JSON.parse(s));return true}catch(e){return false}},
 reset(){if(confirm('Delete your save and start over? This cannot be undone.')){localStorage.removeItem(this.key);T.game.imp(null)}}};
