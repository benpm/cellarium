import { createApp } from 'vue'
import App from './App.vue'
import './index.css'


const app = createApp(App);
app.mixin(
    {
        mounted() {
            this.tooltipNode = document.querySelector("#tooltip p");
        },
        data() {
            return {
                tooltipNode: null
            }
        },
        methods: {
            setTooltip(msg?: string) {
                if (!msg) {
                    this.tooltipNode.style.visibility = "hidden";
                } else {
                    this.tooltipNode.style.visibility = "";
                    this.tooltipNode.innerHTML = msg;
                }
            }
        }
    }
);

app.mount('#app');